# 한참 에디션 메시지 UI 이식

`occm`의 기존 `/direct_message` 화면에 한참 에디션의 메시지 UI·UX를 적용한다.

출처는 한참 [@_longwhile](https://twitter.com/_longwhile)의
[longwhile-mastodon](https://github.com/long-while/longwhile-mastodon)이며,
참고한 포크는 [Lastorder-DEV/longwhile-mastodon의 upgrade/4.4.27](https://github.com/Lastorder-DEV/longwhile-mastodon/tree/70083bc79f6d517d75e2eb79069ac9064509cbfb)이다.
원본 코드의 AGPLv3 라이선스를 유지하며, 대화 목록 하단에도 원작자 링크를 표시한다.

## 적용 범위

- 넓은 화면에서는 350px 대화 목록과 대화 본문을 나란히 표시한다.
- 좁은 화면과 다중 컬럼에서는 목록과 본문을 번갈아 표시한다.
- 대화 상대·대화방 이름 검색, 전체/안 읽음 필터, 빈 목록·대화 선택 안내를 제공한다.
- 그룹 대화 아바타를 겹쳐 표시하고, 이름 없는 그룹은 참여자 이름으로 표시한다.
- 같은 발신자의 3분 이내 메시지를 묶고, 묶음 끝의 말풍선 옆에 시간과 기존 읽음 상태를 표시한다.
- 날짜가 바뀌거나 답장·전송 실패가 있는 경우 새 메시지 묶음을 시작한다.
- 둥근 입력창과 테마 색상의 말풍선을 사용하며, 한국어 IME 확정 Enter는 전송하지 않는다.

## 데이터 호환과 권한

기존 `dm_chat_rooms`, `dm_chat_room_accounts`, `dm_messages`와 첨부파일 테이블,
`/api/v1/dm/*` API, Redux 상태 구조, UUID 대화방 URL, 대화 초대·읽음 처리,
실시간 수신·전송 실패 재시도·기존 대화 마이그레이션을 그대로 사용한다.
DB 마이그레이션이나 서버 API 변경은 없다.

한참 에디션의 `/messages/all` 운영진 전체 채팅 열람 기능, 관련 권한 변경,
운영진 열람 안내 문구는 이식하지 않는다. 기존 참여자 접근 제어를 유지한다.

## 검증

한참 테스트 서버에서는 제공된 일반 사용자 세 계정으로 1:1 대화와 그룹을 실제로
만들고 메시지·답장·줄바꿈·모바일 화면을 확인했다. 비밀번호와 세션은 저장소에 포함하지 않는다.

변경한 occm UI는 로컬 브라우저에서 기존 API 형태의 테스트 응답에 연결해
대화 생성, 기존 1:1·그룹 기록 표시와 전송, 검색·필터, 모바일 뒤로가기,
태블릿·데스크톱 전환, 밝은/어두운 테마를 확인한다. 운영 서버 배포와는 별개이다.

자동 검증 명령:

```sh
yarn test:js run app/javascript/mastodon/features/dm
yarn typecheck
yarn exec eslint app/javascript/mastodon/features/dm
yarn exec stylelint app/javascript/styles/mastodon/dm.scss app/javascript/mastodon/features/ui/components/columns_area/styles.module.scss app/javascript/styles/mastodon-bird-ui/redesign/_layout.scss
yarn build:development
```

검증 결과(2026-11-03): 프런트엔드 13개 테스트, 격리 PostgreSQL/Redis에서 기존
DM API·대화 생성·기존 대화 마이그레이션 관련 6개 테스트가 통과했다.
TypeScript 검사, ESLint, Stylelint와 개발용 전체 빌드도 통과했다.
