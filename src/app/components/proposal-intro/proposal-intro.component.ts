import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-proposal-intro',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './proposal-intro.component.html',
  styleUrl: './proposal-intro.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProposalIntroComponent {}
