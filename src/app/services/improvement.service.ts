import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { rawEnvironment } from '../../environments/back/dev.environment';
import {
  CreateImprovementRequest,
  ImprovementSubmission,
} from '../models/improvement.model';

@Injectable({ providedIn: 'root' })
export class ImprovementService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${rawEnvironment.apiUrl.replace(/\/$/, '')}/improvements`;

  submitImprovement(
    request: CreateImprovementRequest,
  ): Observable<ImprovementSubmission> {
    return this.http.post<ImprovementSubmission>(this.endpoint, request);
  }
}
