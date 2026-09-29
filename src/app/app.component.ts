import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'Improvement Hub';

  constructor(
    private translate: TranslateService
  ) { }

  ngOnInit() {
    this.selectDefaultLanguage();
  }

  selectDefaultLanguage() {
    const browserLang = navigator.language || navigator.languages[0];
    const defaultLang = browserLang.split('-')[0];
    this.translate.setFallbackLang('en');
    this.translate.use(defaultLang.match(/en|es/) ? defaultLang : 'en');
  }
}
