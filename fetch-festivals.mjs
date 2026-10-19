// 한국관광공사 TourAPI 행사정보와 행사별 상세(소개·장소·시간·요금)를 받아 site/festivals.json으로 저장한다.
// GitHub Actions가 매일 실행해 GitHub Pages로 공개한다(.github/workflows/update.yml). 키는 저장소 Secrets에만 있다.
// 직접 실행: DATA_GO_KR_SERVICE_KEY=... node fetch-festivals.mjs
// 호출 수: 목록 1~2번 + 행사마다 상세 2번(약 350번). 개발계정은 하루 1,000번이라 하루 2번 이상 돌리면 막힐 수 있다.
import { mkdir, writeFile } from 'node:fs/promises'

const raw = process.env.DATA_GO_KR_SERVICE_KEY
if (!raw) { console.error('DATA_GO_KR_SERVICE_KEY가 없어요.'); process.exit(1) }
// 공공데이터포털은 인코딩 키와 디코딩 키를 둘 다 준다. 어느 쪽을 넣어도 한 번만 인코딩되게 맞춘다.
const key = raw.includes('%') ? decodeURIComponent(raw) : raw

async function call(operation, params) {
  const url = new URL(`https://apis.data.go.kr/B551011/KorService2/${operation}`)
  url.search = new URLSearchParams({ serviceKey: key, MobileOS: 'ETC', MobileApp: 'festival', _type: 'json', ...params })
  const res = await fetch(url)
  const text = await res.text()
  let body
  try { body = JSON.parse(text) } catch { throw new Error(`TourAPI 응답이 JSON이 아니에요 (${operation}, HTTP ${res.status}): ${text.slice(0, 200)}`) }
  const header = body.response?.header
  if (header?.resultCode !== '0000') throw new Error(`TourAPI 오류 (${operation}): ${header?.resultCode} ${header?.resultMsg ?? text.slice(0, 200)}`)
  const list = body.response.body.items?.item ?? []
  return { list: Array.isArray(list) ? list : [list], total: body.response.body.totalCount }
}

const ymd = d => d.toISOString().slice(0, 10).replaceAll('-', '')
const today = new Date(Date.now() + 9 * 3600_000) // 한국 시간 기준 날짜
// 오래전에 시작해 아직 진행 중인 축제도 잡으려고 넉넉히 앞에서부터 받고, 끝난 건 아래에서 버린다
const from = ymd(new Date(today.getTime() - 180 * 86_400_000))
const todayYmd = ymd(today)

const items = []
for (let page = 1; page < 50; page++) {
  const { list, total } = await call('searchFestival2', { eventStartDate: from, numOfRows: '500', pageNo: String(page), arrange: 'A' })
  items.push(...list)
  if (items.length >= total || list.length === 0) break
}

const coord = v => { const n = Number(v); return Number.isFinite(n) && n !== 0 ? n : undefined } // 좌표가 없으면 0이나 빈 문자열로 온다
const https = u => u ? u.replace(/^http:\/\//, 'https://') : undefined // 토스 WebView는 https만 안전하게 띄운다
// 상세 글에는 <br>·<a> 같은 HTML이 섞여 온다. 앱은 글자만 보여주므로 태그를 걷어낸다(링크는 외부 이동 제한으로 쓰지 않는다)
const plain = v => {
  const s = String(v ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim()
  return s || undefined
}

const live = items.filter(i => i.eventenddate >= todayYmd)

async function details(id) {
  try {
    const [common, intro] = await Promise.all([
      call('detailCommon2', { contentId: id }),
      call('detailIntro2', { contentId: id, contentTypeId: '15' }),
    ])
    const c = common.list[0] ?? {}, n = intro.list[0] ?? {}
    return {
      overview: plain(c.overview),
      place: plain(n.eventplace),
      hours: plain(n.playtime),
      fee: plain(n.usetimefestival),
      host: plain(n.sponsor1),
      age: plain(n.agelimit),
    }
  } catch (e) {
    // 상세 하나가 실패해도 목록은 살린다. 카드는 상세 없이 기본 정보만 보여준다
    console.warn(`상세를 못 받았어요 ${id}: ${e.message}`)
    return {}
  }
}

const extra = {}
for (let i = 0; i < live.length; i += 5) { // 한꺼번에 몰리지 않게 5개씩
  const batch = live.slice(i, i + 5)
  const got = await Promise.all(batch.map(it => details(String(it.contentid))))
  batch.forEach((it, j) => { extra[it.contentid] = got[j] })
}

const festivals = live.map(i => ({
  id: String(i.contentid),
  title: i.title.trim(),
  start: i.eventstartdate,
  end: i.eventenddate,
  addr: [i.addr1, i.addr2].filter(Boolean).join(' ').trim(),
  image: https(i.firstimage) || https(i.firstimage2),
  tel: i.tel || undefined,
  lat: coord(i.mapy),
  lng: coord(i.mapx),
  ...extra[i.contentid],
}))

// 전국에 진행 중인 축제가 0건일 리 없다. 그럴 땐 API 이상으로 보고 실패시켜 어제 공개한 파일을 그대로 둔다
if (festivals.length === 0) throw new Error('끝나지 않은 축제가 0건이에요. API 응답을 확인해 주세요.')
await mkdir(new URL('./site/', import.meta.url), { recursive: true })
await writeFile(new URL('./site/festivals.json', import.meta.url), JSON.stringify({ updatedAt: new Date().toISOString(), sample: false, items: festivals }))
const withOverview = festivals.filter(f => f.overview).length
console.log(`받은 행사 ${items.length}건 중 끝나지 않은 ${festivals.length}건을 저장했어요. 소개글 있는 행사 ${withOverview}건.`)
