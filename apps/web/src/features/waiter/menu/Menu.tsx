import { visibleProducts } from "./catalog";
import { useState } from "react";
import {
  label,
  type Product,
  type Preferences,
} from "../../../../../../packages/contracts/src/index";
import { Field } from "../../../../../../packages/ui/src/index";
import type { AppState } from "../../../shared/api/api";
import { euro, type Language, type T } from "../../../shared/i18n/i18n";
type Props = {
  state: AppState;
  language: Language;
  t: T;
  preferences: Preferences;
  setPreferences: (p: Preferences) => void;
  busy: boolean;
  onAdd: (p: Product) => void;
  onEdit: (p: Product) => void;
};

export function Menu({
  state,
  language,
  t,
  preferences,
  setPreferences,
  busy,
  onAdd,
  onEdit,
}: Props) {
  const [menuSearch, setMenuSearch] = useState("");
  const [category, setCategory] = useState("");
  const [favorites, setFavorites] = useState(false);
  return (
    <section className="panel">
      <div className="row between">
        <h2 className="menu-title" tabIndex={-1}>
          {t("menu")}
        </h2>
        <div className="segmented">
          {(["list", "tiles"] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={preferences.menu === mode}
              onClick={() => setPreferences({ ...preferences, menu: mode })}
            >
              {t(mode)}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <Field label={t("search")}>
          <input
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
          />
        </Field>
        <select
          aria-label={t("category")}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">{t("all")}</option>
          {state.configuration.policy.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {label(c.name, language)}
            </option>
          ))}
        </select>
        <button
          aria-pressed={favorites}
          onClick={() => setFavorites(!favorites)}
        >
          ☆ {t("favorites")}
        </button>
      </div>
      <div className={`menu ${preferences.menu}`}>
        {visibleProducts(state.products, {
          search: menuSearch,
          category,
          favoritesOnly: favorites,
          favorites: preferences.favorites,
          categoryOrder: state.configuration.policy.categories.map((c) => c.id),
        }).map((p) => (
          <article key={p.id} className="product">
            <div>
              <small>
                {label(
                  state.configuration.policy.categories.find(
                    (c) => c.id === p.category,
                  )?.name ?? { de: "", en: "" },
                  language,
                )}
              </small>
              <h3>{label(p.name, language)}</h3>
              {p.description && <p>{label(p.description, language)}</p>}
              <strong>{euro(p.price, language)}</strong>
            </div>
            <div className="row">
              <button
                aria-label={`${t("favorites")} ${label(p.name, language)}`}
                aria-pressed={preferences.favorites.includes(p.id)}
                onClick={() =>
                  setPreferences({
                    ...preferences,
                    favorites: preferences.favorites.includes(p.id)
                      ? preferences.favorites.filter((id) => id !== p.id)
                      : [...preferences.favorites, p.id],
                  })
                }
              >
                ☆
              </button>
              <button
                disabled={busy}
                className="primary"
                aria-label={`${t("add")} ${label(p.name, language)}`}
                onClick={() => onAdd(p)}
              >
                + {t("add")}
              </button>
              <button
                aria-label={`${t("edit")} ${label(p.name, language)}`}
                onClick={() => onEdit(p)}
              >
                {t("edit")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
