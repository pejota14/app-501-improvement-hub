import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import {
  CreateImprovementRequest,
  ImprovementArea,
  ImprovementImpact,
  ImprovementSubmission,
} from '../../models/improvement.model';
import { ImprovementService } from '../../services/improvement.service';
import { ProposalIntroComponent } from '../proposal-intro/proposal-intro.component';
import { SubmissionSuccessComponent } from '../submission-success/submission-success.component';

function requiredTrimmed(control: AbstractControl): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim().length
    ? null
    : { required: true };
}

@Component({
  selector: 'app-proposal-page',
  standalone: true,
  imports: [
    HttpClientModule,
    ReactiveFormsModule,
    TranslatePipe,
    ProposalIntroComponent,
    SubmissionSuccessComponent,
  ],
  templateUrl: './proposal-page.component.html',
  styleUrl: './proposal-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProposalPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly improvementService = inject(ImprovementService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly areas: ImprovementArea[] = ['engineering', 'product', 'operations', 'other'];
  readonly impacts: ImprovementImpact[] = ['low', 'medium', 'high'];
  isSubmitting = false;
  submitError = false;
  submission: ImprovementSubmission | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', [requiredTrimmed]],
    email: ['', [Validators.required, Validators.email]],
    area: ['' as ImprovementArea | '', [Validators.required]],
    title: ['', [requiredTrimmed, Validators.maxLength(100)]],
    description: ['', [requiredTrimmed]],
    expectedImpact: ['' as ImprovementImpact | '', [Validators.required]],
  });

  hasError(field: keyof typeof this.form.controls, error?: string): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || control.dirty) && (!error || control.hasError(error));
  }

  submit(): void {
    this.submitError = false;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      window.setTimeout(() =>
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
      );
      return;
    }

    this.isSubmitting = true;
    const value = this.form.getRawValue();
    const request: CreateImprovementRequest = {
      name: value.name.trim(),
      email: value.email.trim(),
      area: value.area as ImprovementArea,
      title: value.title.trim(),
      description: value.description.trim(),
      expectedImpact: value.expectedImpact as ImprovementImpact,
    };

    this.improvementService.submitImprovement(request).pipe(
      finalize(() => {
        this.isSubmitting = false;
        this.changeDetector.markForCheck();
      }),
    ).subscribe({
      next: (submission) => {
        this.submission = submission;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: () => (this.submitError = true),
    });
  }

  startAnother(): void {
    this.form.reset();
    this.submitError = false;
    this.submission = null;
  }
}
