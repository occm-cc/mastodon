# 예약 게시물 V2 API

웹 작성창의 예약 기능은 `/api/v2/scheduled_statuses`를 사용한다. V1의 `/api/v1/statuses` 예약 생성 및 `/api/v1/scheduled_statuses` 조회·시간 수정·취소 경로와 요청·응답 형식은 유지한다. 예약 테이블과 기존 발행 서비스를 공유한다.

## 엔드포인트

| 요청                                    | 기능                       | OAuth scope                   |
| --------------------------------------- | -------------------------- | ----------------------------- |
| `GET /api/v2/scheduled_statuses`        | 현재 계정의 예약 목록      | `read` 또는 `read:statuses`   |
| `GET /api/v2/scheduled_statuses/:id`    | 예약 내용과 첨부 조회      | `read` 또는 `read:statuses`   |
| `POST /api/v2/scheduled_statuses`       | 예약 생성                  | `write` 또는 `write:statuses` |
| `PUT /api/v2/scheduled_statuses/:id`    | 같은 예약의 내용·시간 수정 | `write` 또는 `write:statuses` |
| `DELETE /api/v2/scheduled_statuses/:id` | 예약 취소                  | `write` 또는 `write:statuses` |

모든 요청은 정상 사용 가능한 사용자 계정이 필요하다. 다른 계정의 예약 ID는 404로 처리한다. 취소 성공 응답은 기존 API와 같이 `{}`이다.

목록은 기존 ID 기반 페이지네이션을 사용하며 `limit`, `max_id`, `since_id`, `min_id` 및 `Link` 헤더를 지원한다. 기본 페이지 크기는 20, 최대는 40이다. 웹 관리 화면은 전체 페이지를 가져와 예정 시각과 ID로 정렬한다.

## 생성·수정 요청

기존 게시물 생성 필드를 재사용한다.

```json
{
  "status": "예약할 게시물",
  "scheduled_at": "2026-10-12T09:00:00.000Z",
  "language": "ko",
  "visibility": "public",
  "sensitive": false,
  "spoiler_text": "",
  "media_ids": [],
  "poll": null,
  "in_reply_to_id": null,
  "quoted_status_id": null,
  "quote_approval_policy": "public"
}
```

- 생성에는 `scheduled_at`이 필요하다. ISO 8601의 절대 시각이며 UTC의 `Z` 또는 명시적인 시차를 사용할 수 있다.
- 생성은 `Idempotency-Key` 헤더를 지원한다.
- PUT에서 생략한 필드는 기존 값을 유지한다. `scheduled_at` 생략도 기존 시각을 유지한다.
- 투표 삭제는 `poll: null`, 첨부 해제는 `media_ids: []`, CW 해제는 `spoiler_text: ""`로 요청한다.
- `poll`은 `options`, `expires_in`, `multiple`, `hide_totals`를 지원한다. `expires_in`은 실제 발행 시점부터의 투표 기간이다.
- 첨부 설명·초점 수정은 `media_attributes: [{ "id": "...", "description": "...", "focus": "0.00,0.00" }]`로 요청한다. 저장 트랜잭션에서 미디어 연결과 함께 반영한다.
- `allowed_mentions`도 기존 게시물 옵션으로 저장한다.
- 답장 대상의 열람 권한과 인용 권한을 검사한다. 미디어는 현재 계정 소유여야 하며, 다른 게시물이나 다른 예약에서 사용 중인 미디어는 가져올 수 없다.
- PUT은 예약을 삭제·재생성하지 않는다. 성공 응답에서도 기존 예약 ID가 유지된다.

## 응답

기존 예약 응답 형태를 재사용하며 일반 게시물 응답과 구분한다.

```json
{
  "id": "900",
  "scheduled_at": "2026-10-12T09:00:00.000Z",
  "params": {
    "text": "예약할 게시물",
    "language": "ko",
    "visibility": "public",
    "sensitive": false,
    "spoiler_text": "",
    "in_reply_to_id": null,
    "quoted_status_id": null,
    "quote_approval_policy": "public",
    "poll": null
  },
  "media_attachments": []
}
```

`params`에는 기존 예약 시스템의 추가 옵션도 포함될 수 있다. V2는 답장·인용 ID를 문자열로 반환하고 첨부를 저장된 순서로 반환한다. 언어가 명시되지 않은 V1 예약도 기존 발행 서비스의 언어 fallback을 적용해 V2 응답에 유효한 게시 언어를 제공한다. 민감한 미디어 표시와 투표 체크박스 값도 기존 폼 요청의 문자열 대신 boolean으로 제공한다. V1 응답은 바꾸지 않는다.

예약 응답에는 일반 게시물의 `account`, `url`, `tags` 등이 있다고 가정하면 안 된다. 웹은 이를 타임라인에 삽입하지 않고, 성공 알림에서 예약 목록을 열도록 한다.

## 시간 검증과 호환성

- V2는 현재로부터 **5분 초과**인 시각만 허용한다. 누락·과거·너무 가까운 시각과 잘못된 형식은 422로 처리하며 즉시 게시하지 않는다.
- V1의 과거 `scheduled_at`이 즉시 게시로 처리되는 기존 동작은 유지한다.
- V1 PUT은 계속 예약 시간만 수정한다. `status` 등의 새로운 내용 필드를 보내도 기존과 같이 무시한다.
- 전체 300개·일별 25개의 기존 제한을 사용한다. 예약 수정 시 자기 자신을 제한에 중복 계산하는 모델 검증 오류를 보완했다.
- 발행 작업은 DB의 최신 시각을 다시 확인한다. 이전 시각에 큐에 들어간 작업은 미래로 변경된 예약을 조기 발행하지 않는다.
- V2 수정·취소·발행은 예약 행의 잠금으로 조정한다. 발행 실패로 DB 작업이 롤백되면 예약이 유지되며, 동일 예약의 중복 발행을 방지한다. 게시물 배포·알림 작업은 발행 트랜잭션 커밋 이후에 실행한다.

## 웹 작성창의 언어 정책

새 게시물과 새 예약은 UI locale을 지원되는 게시 언어 코드로 변환해 사용한다. 답장·인용도 이 정책을 따른다. 이미 게시된 글과 기존 예약을 편집할 때는 원래 게시 언어를 보존한다. 언어 선택 버튼과 언어 변경 제안은 제거했다.

API 클라이언트의 `language` 지원은 유지한다. 사용자가 웹 작성창에서 언어를 선택하지 못하는 정책과 API의 언어 필드를 구분한다.
