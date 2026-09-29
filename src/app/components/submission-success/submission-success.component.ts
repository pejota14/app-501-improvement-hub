import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ImprovementSubmission } from '../../models/improvement.model';

@Component({
  selector: 'app-submission-success',
  standalone: true,
  imports: [DatePipe, TranslatePipe],
  templateUrl: './submission-success.component.html',
  styleUrl: './submission-success.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmissionSuccessComponent {
  @Input({ required: true }) submission!: ImprovementSubmission;
  @Output() createAnother = new EventEmitter<void>();
  copied = false;

  async copyReference(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.submission.referenceNumber);
      this.copied = true;
      window.setTimeout(() => (this.copied = false), 1800);
    } catch {
      this.copied = false;
    }
  }
}
