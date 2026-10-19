# festival-data

토스 미니앱 "축제 알리미"가 읽는 전국 축제 데이터.

- 주소: https://limsupil.github.io/festival-data/festivals.json
- 갱신: 매일 03:00(한국 시간) GitHub Actions가 `fetch-festivals.mjs`를 실행해 GitHub Pages로 배포한다.
- 자료: 한국관광공사 TourAPI 국문 관광정보 서비스(공공누리). 앱 화면에 출처를 표시한다.
- 키: 저장소 Settings → Secrets의 `DATA_GO_KR_SERVICE_KEY`. 코드와 파일에는 없다.
- 실패하면 배포하지 않으므로 전날 파일이 남는다. Actions 탭에서 실패 기록을 확인한다.
- 호출 수: 하루 약 350번(개발계정 한도 1,000번). 손으로 여러 번 돌리면 한도에 걸릴 수 있다.

앱 코드는 비공개 작업공간 `toss-miniapps-workspace/festival`에 있다.
