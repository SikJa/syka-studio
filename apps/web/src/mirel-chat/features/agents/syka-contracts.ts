export type AgentFeedbackVerdict='useful'|'needs_correction'|'missing_context';
export type AgentOperationalActivity={id:string;kind:'status'|'tool';state:'started'|'progress'|'completed'|'failed';label:string;summary?:string;durationSeconds?:number;webSearch?:{operation:'search'|'extract';query?:string;resultCount?:number;sources?:{title:string;url:string;domain:string}[]}};
export type AgentThreadMessage={id:string;role:'user'|'assistant';content:string;createdAt:string;feedback?:{verdict:AgentFeedbackVerdict;comment:string|null};attachments?:{assetRef:string;contentUrl:string;previewUrl?:string;mimeType:string;name:string;size:number;processingState?:'stored'|'processing'|'available'|'failed'}[]};

export type AgentStoredAttachment=NonNullable<AgentThreadMessage["attachments"]>[number];
