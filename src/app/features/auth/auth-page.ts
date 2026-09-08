import { Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { email as emailValidator, form, FormField, minLength, required } from '@angular/forms/signals';
import { AuthService } from '@core/auth/auth.service';
import { SeoService } from '@core/seo/seo.service';

type AuthMode = 'signin' | 'signup';

/**
 * Giriş / kayıt — `/giris` (Faz 7).
 *
 * Tek sayfada iki mod: `signin` ve `signup`. `redirect` query param'ı
 * (`?redirect=/taksi/x/sahiplen`) başarılı işlemden sonra kullanıcıyı asıl
 * niyet ettiği sayfaya döndürür — `sahiplen`/`panel` sayfaları oturum yoksa
 * buraya bu parametreyle yönlendirir.
 *
 * `RenderMode.Client` (bkz. `app.routes.server.ts`): oturum durumu istemciye
 * özgüdür, SSR'da anlamsızdır ve zaten `noindex`tir.
 *
 * E-POSTA ONAYI: canlı Supabase projesinde doğrulandı — `signUp()` başarıyla
 * dönse bile oturum HEMEN açılmaz (bkz. `AuthService` yorumu). Bu yüzden kayıt
 * sonrası ya doğrudan yönlendirme ya da "e-postanızı kontrol edin" mesajı
 * gösterilir; ikisi de gerçek API yanıtına göre belirlenir, hiçbiri varsayılmaz.
 */
@Component({
  selector: 'app-auth-page',
  imports: [FormField],
  template: `
    <div class="container page">
      <h1 class="page-title">{{ mode() === 'signin' ? 'Giriş Yap' : 'Hesap Oluştur' }}</h1>
      <p class="lead">
        {{
          mode() === 'signin'
            ? 'İşletme panelinize erişmek için giriş yapın.'
            : 'İşletmenizi sahiplenmek için önce ücretsiz bir hesap oluşturun.'
        }}
      </p>

      @if (confirmationPending()) {
        <div class="form-banner form-banner--success" role="status">
          <strong>E-postanızı kontrol edin.</strong> Hesabınızı onaylamak için gönderdiğimiz
          bağlantıya tıklayın, ardından giriş yapabilirsiniz.
        </div>
      } @else {
        <form class="card" novalidate (submit)="onSubmit($event)">
          @if (errorMessage(); as msg) {
            <p class="form-banner form-banner--error" role="alert">{{ msg }}</p>
          }

          <div class="field">
            <label class="field__label" for="auth-email">E-posta</label>
            <input
              id="auth-email"
              class="field__input"
              type="email"
              autocomplete="email"
              [formField]="authForm.email"
            />
            @if (authForm.email().touched() && authForm.email().errors()[0]; as err) {
              <p class="field__error">{{ err.message }}</p>
            }
          </div>

          <div class="field">
            <label class="field__label" for="auth-password">Şifre</label>
            <input
              id="auth-password"
              class="field__input"
              type="password"
              [autocomplete]="mode() === 'signin' ? 'current-password' : 'new-password'"
              [formField]="authForm.password"
            />
            @if (authForm.password().touched() && authForm.password().errors()[0]; as err) {
              <p class="field__error">{{ err.message }}</p>
            }
          </div>

          <button type="submit" class="btn btn--brand btn--block" [disabled]="submitting()">
            {{ submitting() ? 'Gönderiliyor…' : mode() === 'signin' ? 'Giriş Yap' : 'Hesap Oluştur' }}
          </button>
        </form>

        <p class="switch-mode muted">
          @if (mode() === 'signin') {
            Hesabınız yok mu?
            <button type="button" class="link-button" (click)="toggleMode()">Kayıt olun</button>
          } @else {
            Zaten hesabınız var mı?
            <button type="button" class="link-button" (click)="toggleMode()">Giriş yapın</button>
          }
        </p>
      }
    </div>
  `,
  styles: `
    .page {
      padding-block: var(--sp-8) var(--sp-12);
      max-width: 28rem;
    }

    .lead {
      margin-block: var(--sp-2) var(--sp-6);
    }

    form.card {
      display: flex;
      flex-direction: column;
    }

    form.card > * + * {
      margin-block-start: var(--sp-4);
    }

    .switch-mode {
      margin-block-start: var(--sp-5);
      text-align: center;
    }

    .link-button {
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      color: var(--c-action);
      text-decoration: underline;
      cursor: pointer;
    }
  `,
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  /** `?redirect=` query param'ı — `withComponentInputBinding()` ile otomatik bağlanır. */
  readonly redirect = input<string>();

  protected readonly mode = signal<AuthMode>('signin');
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly confirmationPending = signal(false);

  private readonly model = signal({ email: '', password: '' });
  protected readonly authForm = form(this.model, (path) => {
    required(path.email, { message: 'E-posta gerekli.' });
    emailValidator(path.email, { message: 'Geçerli bir e-posta adresi girin.' });
    required(path.password, { message: 'Şifre gerekli.' });
    minLength(path.password, 6, { message: 'Şifre en az 6 karakter olmalı.' });
  });

  constructor() {
    this.seo.setPage({
      title: 'Giriş Yap — Kütahya Taksi Ağı',
      description: 'İşletme panelinize erişmek veya işletmenizi sahiplenmek için giriş yapın.',
      path: '/giris',
      noindex: true,
    });

    // Zaten oturum açıksa bu sayfada oyalanmaz, hedefe geçer.
    effect(() => {
      if (this.auth.ready() && this.auth.isAuthenticated()) {
        this.navigateAfterAuth();
      }
    });
  }

  protected toggleMode(): void {
    this.mode.update((m) => (m === 'signin' ? 'signup' : 'signin'));
    this.errorMessage.set(null);
  }

  protected async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.authForm().markAsTouched();
    if (this.authForm().errorSummary().length > 0) {
      return;
    }

    this.errorMessage.set(null);
    this.submitting.set(true);
    const { email, password } = this.model();

    if (this.mode() === 'signin') {
      const result = await this.auth.signIn(email, password);
      this.submitting.set(false);
      if (result?.error) {
        this.errorMessage.set(result.error);
        return;
      }
      this.navigateAfterAuth();
      return;
    }

    const result = await this.auth.signUp(email, password);
    this.submitting.set(false);
    if ('error' in result) {
      this.errorMessage.set(result.error);
      return;
    }
    if (result.confirmed) {
      this.navigateAfterAuth();
    } else {
      this.confirmationPending.set(true);
    }
  }

  private navigateAfterAuth(): void {
    void this.router.navigateByUrl(this.redirect() || '/panel');
  }
}
