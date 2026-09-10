/** Header presentation; App supplies guarded logout and preference callbacks. */
import type { User } from "../../../../packages/contracts/src/index";
import type { Language, T } from "../shared/i18n/i18n";

type Props = {
  branding: string;
  user: User | null;
  language: Language;
  t: T;
  onLanguage: (language: Language) => void;
  onLogout: () => void;
};

export function AppHeader({
  branding,
  user,
  language,
  t,
  onLanguage,
  onLogout,
}: Props) {
  return (
    <header className="app-header">
      <a className="brand" href="/">
        {branding}
        <small>RESTAURANT OPERATIONS</small>
      </a>
      <div className="row">
        <select
          aria-label="Sprache / Language"
          value={language}
          onChange={(event) => onLanguage(event.target.value as Language)}
        >
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
        {user && (
          <>
            <span>
              {user.username} · {t(user.role)}
            </span>
            <button onClick={onLogout}>{t("signOut")}</button>
          </>
        )}
      </div>
    </header>
  );
}
