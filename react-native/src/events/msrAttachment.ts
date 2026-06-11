export type AttachmentType = 'screenshot';

export interface MsrAttachment {
  name: string;
  type: AttachmentType;
  bytes?: string;
  path?: string | null;
  size: number;
  id: string;
}
