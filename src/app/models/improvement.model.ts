export type ImprovementArea = 'engineering' | 'product' | 'operations' | 'other';

export type ImprovementImpact = 'low' | 'medium' | 'high';

export interface CreateImprovementRequest {
  name: string;
  email: string;
  area: ImprovementArea;
  title: string;
  description: string;
  expectedImpact: ImprovementImpact;
}

export interface ImprovementSubmission {
  id: string;
  referenceNumber: string;
  status: 'Submitted';
  createdAt: string;
}
