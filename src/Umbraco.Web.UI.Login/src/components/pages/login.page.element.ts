import type { UUIButtonElement, UUIButtonState } from '@umbraco-ui/uui';
import { css, CSSResultGroup, html, LitElement, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { when } from 'lit/directives/when.js';
import { until } from 'lit/directives/until.js';

import { umbAuthContext } from '../../context/auth.context.js';
import { umbLocalizationContext } from '../../external/localization/localization-context.js';

@customElement('umb-login-page')
export default class UmbLoginPageElement extends LitElement {
	@query('#umb-login-button')
	submitButtonElement?: UUIButtonElement;

	@property({ type: Boolean, attribute: 'username-is-email' })
	usernameIsEmail = false;

	@queryAssignedElements({ flatten: true })
	protected slottedElements?: HTMLInputElement[];

	@property({ type: Boolean, attribute: 'allow-password-reset' })
	allowPasswordReset = false;

	@state()
	private _loginState: UUIButtonState = undefined;

	@state()
	private _loginError = '';

	@state()
	private get disableLocalLogin() {
		return umbAuthContext.disableLocalLogin;
	}

	#usernameInputElement?: HTMLInputElement;
	#passwordInputElement?: HTMLInputElement;

	connectedCallback(): void {
		super.connectedCallback();

		requestAnimationFrame(() => {
			const inputElements = this.slottedElements?.filter(
				(node) => node.tagName && node.tagName.toLowerCase() === 'input'
			);

			this.#usernameInputElement = inputElements?.find((node) => node.name === 'username');
			this.#passwordInputElement = inputElements?.find((node) => node.name === 'password');

			this.#usernameInputElement?.addEventListener('keydown', this.#onInputKeydown);
			this.#passwordInputElement?.addEventListener('keydown', this.#onInputKeydown);
		});
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();

		this.#usernameInputElement?.removeEventListener('keydown', this.#onInputKeydown);
		this.#passwordInputElement?.removeEventListener('keydown', this.#onInputKeydown);
	}

	#onInputKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Enter') {
			this.submitButtonElement?.click();
		}
	};

	#handleSubmit = async (e: SubmitEvent) => {
		e.preventDefault();

		const form = e.target as HTMLFormElement;
		if (!form) return;

		if (!form.checkValidity()) return;

		if (!this.#usernameInputElement || !this.#passwordInputElement) return;

		if (!this.#usernameInputElement.checkValidity() || !this.#passwordInputElement.checkValidity()) return;

		const formData = new FormData(form);

		const username = this.#usernameInputElement.value;
		const password = this.#passwordInputElement.value;
		const persist = formData.has('persist');

		this._loginState = 'waiting';

		const response = await umbAuthContext.login({
			username,
			password,
			persist,
		});

		this._loginError = response.error || '';
		this._loginState = response.error ? 'failed' : 'success';

		// Check for 402 status code indicating that MFA is required
		if (response.status === 402) {
			umbAuthContext.isMfaEnabled = true;
			if (response.twoFactorView) {
				umbAuthContext.twoFactorView = response.twoFactorView;
			}

			this.dispatchEvent(new CustomEvent('umb-login-flow', { composed: true, detail: { flow: 'mfa' } }));
			return;
		}

		if (response.error) {
			this.dispatchEvent(new CustomEvent('umb-login-failed', { bubbles: true, composed: true, detail: response }));
			return;
		}

		const returnPath = umbAuthContext.returnPath;

		if (returnPath) {
			location.href = returnPath;
		}

		this.dispatchEvent(new CustomEvent('umb-login-success', { bubbles: true, composed: true, detail: response.data }));
	};

	get #greetingLocalizationKey() {
		return [
			'login_greeting0',
			'login_greeting1',
			'login_greeting2',
			'login_greeting3',
			'login_greeting4',
			'login_greeting5',
			'login_greeting6',
		][new Date().getDay()];
	}

	render() {
		return html`
			<h1 id="greeting" class="uui-h3">
				<umb-localize .key=${this.#greetingLocalizationKey}></umb-localize>
			</h1>
			<slot name="subheadline"></slot>
			${this.disableLocalLogin
				? nothing
				: html`
						<uui-form>
							<form id="LoginForm" name="login" @submit="${this.#handleSubmit}">
								<slot></slot>
								<!-- <uui-form-layout-item>
									<uui-label id="emailLabel" for="umb-username" slot="label" required>
										${this.usernameIsEmail
									? html`<umb-localize key="general_email">Email</umb-localize>`
									: html`<umb-localize key="user_username">Name</umb-localize>`}
									</uui-label>
									<uui-input
										type=${this.usernameIsEmail ? 'email' : 'text'}
										id="umb-username"
										name="email"
										autocomplete=${this.usernameIsEmail ? 'username' : 'email'}
										.label=${this.usernameIsEmail
									? until(umbLocalizationContext.localize('general_email', undefined, 'Email'))
									: until(umbLocalizationContext.localize('user_username', undefined, 'Username'))}
										required
										required-message=${until(umbLocalizationContext.localize('general_required', undefined, 'Required'))}></uui-input>
								</uui-form-layout-item>

								<uui-form-layout-item>
									<uui-label id="passwordLabel" for="umb-password" slot="label" required>
										<umb-localize key="user_password">Password</umb-localize>
									</uui-label>
									<uui-input-password
										id="umb-password"
										name="password"
										autocomplete="current-password"
										.label=${until(umbLocalizationContext.localize('user_password', undefined, 'Password'))}
										required
										required-message=${until(
									umbLocalizationContext.localize('general_required', undefined, 'Required')
								)}></uui-input-password>
								</uui-form-layout-item> -->

								<div id="secondary-actions">
									${when(
										umbAuthContext.supportsPersistLogin,
										() => html`<uui-form-layout-item>
											<uui-checkbox
												name="persist"
												.label=${until(umbLocalizationContext.localize('user_rememberMe', undefined, 'Remember me'))}>
												<umb-localize key="user_rememberMe">Remember me</umb-localize>
											</uui-checkbox>
										</uui-form-layout-item>`
									)}
									${when(
										this.allowPasswordReset,
										() =>
											html`<button type="button" id="forgot-password" @click=${this.#handleForgottenPassword}>
												<umb-localize key="login_forgottenPassword">Forgotten password?</umb-localize>
											</button>`
									)}
								</div>

								${this.#renderErrorMessage()}

								<uui-button
									type="submit"
									id="umb-login-button"
									look="primary"
									.label=${until(umbLocalizationContext.localize('general_login', undefined, 'Login'))}
									color="default"
									.state=${this._loginState}></uui-button>
							</form>
						</uui-form>
				  `}
			<umb-external-login-providers-layout .showDivider=${!this.disableLocalLogin}>
				<slot name="external"></slot>
			</umb-external-login-providers-layout>
		`;
	}

	#renderErrorMessage() {
		if (!this._loginError || this._loginState !== 'failed') return nothing;

		return html`<span class="text-error text-danger">${this._loginError}</span>`;
	}

	#handleForgottenPassword() {
		this.dispatchEvent(new CustomEvent('umb-login-flow', { composed: true, detail: { flow: 'reset' } }));
	}

	static styles: CSSResultGroup = [
		css`
			:host {
				display: flex;
				flex-direction: column;
			}

			::slotted(input) {
				font-family: inherit;
				background: none;
				background-color: var(--uui-input-background-color, var(--uui-color-surface, #fff));
				padding: var(--uui-size-1, 3px) var(--uui-size-space-3, 9px);
				font-size: inherit;
				color: inherit;
				border-radius: 0px;
				box-sizing: border-box;
				text-align: inherit;
				width: 100%;
				height: 38px;
				border-radius: var(--uui-border-radius);
				box-sizing: border-box;
				border: var(--uui-input-border-width, 1px) solid var(--uui-input-border-color, var(--uui-color-border, #d8d7d9));
				position: relative;
				outline: transparent;
			}
			::slotted(input:focus) {
				border-color: var(--uui-input-border-color-focus, var(--uui-color-border-emphasis, #a1a1a1));
			}
			::slotted(input:hover:not(:focus)) {
				border-color: var(--uui-input-border-color-hover, var(--uui-color-border-standalone, #c2c2c2));
			}
			::slotted(label) {
				font-family: inherit;
				font-size: inherit;
				color: inherit;
				font-weight: bold;
			}
			::slotted(input#username-input) {
				margin-bottom: var(--uui-size-space-3);
			}

			#greeting {
				color: var(--uui-color-interactive);
				text-align: center;
				font-weight: 400;
				font-size: 1.5rem;
				margin: 0 0 var(--uui-size-layout-2);
				line-height: 1.2 !important;
			}

			form {
				display: flex;
				flex-direction: column;
				gap: var(--uui-size-space-2);
			}

			uui-form-layout-item {
				margin: 0;
			}

			uui-input,
			uui-input-password {
				width: 100%;
				height: 38px;
				border-radius: var(--uui-border-radius);
			}

			#umb-login-button {
				width: 100%;
				--uui-button-padding-top-factor: 1.5;
				--uui-button-padding-bottom-factor: 1.5;
			}

			#forgot-password {
				cursor: pointer;
				background: none;
				border: 0;
				height: 1rem;
				color: var(--uui-color-text-alt); /* TODO Change to uui color when uui gets a muted text variable */
				gap: var(--uui-size-space-1);
				align-self: center;
				text-decoration: none;
				display: inline-flex;
				line-height: 1;
				font-size: 14px;
				font-family: var(--uui-font-family);
			}

			#forgot-password:hover {
				color: var(--uui-color-interactive-emphasis);
			}

			.text-danger {
				color: var(--uui-color-danger-standalone);
			}

			#secondary-actions {
				display: flex;
				align-items: center;
				justify-content: space-between;
			}

			@media (min-width: 850px) {
				:host #greeting {
					font-size: 2rem;
					margin: 0 0 var(--uui-size-layout-3);
				}
			}
		`,
	];
}

declare global {
	interface HTMLElementTagNameMap {
		'umb-login-page': UmbLoginPageElement;
	}
}
