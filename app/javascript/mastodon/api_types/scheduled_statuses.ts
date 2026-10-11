import type { ApiMediaAttachmentJSON } from './media_attachments';
import type { ApiQuotePolicy } from './quotes';
import type { StatusVisibility } from './statuses';

export interface ApiScheduledStatusJSON {
  id: string;
  scheduled_at: string;
  params: {
    text: string;
    spoiler_text?: string;
    sensitive?: boolean;
    visibility?: StatusVisibility;
    language?: string | null;
    in_reply_to_id?: string | null;
    quoted_status_id?: string | null;
    quote_approval_policy?: ApiQuotePolicy;
    poll?: {
      options: string[];
      expires_in: number;
      multiple?: boolean;
      hide_totals?: boolean;
    } | null;
  };
  media_attachments: ApiMediaAttachmentJSON[];
}
