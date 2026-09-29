import { Routes } from '@angular/router';
import { ProposalPageComponent } from './components/proposal-page/proposal-page.component';

export const routes: Routes = [
  {
    path: '',
    component: ProposalPageComponent,
    title: 'Improvement Hub',
  },
  {
    path: '**',
    redirectTo: '',
  },
];
