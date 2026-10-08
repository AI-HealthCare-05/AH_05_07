import { StartingHomeControl } from "../ui/StartingHomeControl";
import { dataScopeLabel } from "../ui/dataScope";
import { shiftDate } from "../lib/seoulDate";
import { companionIdentityOptions } from "../ui/companionIdentity";
import type { CompanionSpecies } from "../ui/companion";
import { themePreferenceOptions, type ThemePreference } from "../ui/themePreference";
import { journeyCopy } from "../ui/journey";
import { Scene } from "./SceneShell";

type Props = Readonly<{
  journey: boolean;
  today: string;
  evidenceMode: boolean;
  settingsControlsDisabled: boolean;
  exportPending: boolean;
  themePreference: ThemePreference;
  browserPersonalizationVersion: number;
  showCompanionSettings: boolean;
  companionSpeciesPreference: CompanionSpecies;
  signOutPending: boolean;
  accountDeletionPending: boolean;
  onOpenRecap: () => void;
  onExportRecentThirtyDays: () => void;
  onThemeChange: (value: string) => void;
  onCompanionSpeciesChange: (species: CompanionSpecies) => void;
  onResetBrowserPersonalization: () => void;
  onSignOut: () => void;
  onRequestAccountDeletion: () => void;
}>;

/** S14 markup and presentation-only controls. App owns auth, persistence and effects. */
export function SignedInSettingsPresentation({
  journey, today, evidenceMode, settingsControlsDisabled, exportPending,
  themePreference, browserPersonalizationVersion, showCompanionSettings,
  companionSpeciesPreference, signOutPending, accountDeletionPending,
  onOpenRecap, onExportRecentThirtyDays, onThemeChange,
  onCompanionSpeciesChange, onResetBrowserPersonalization,
  onSignOut, onRequestAccountDeletion,
}: Props) {
      if (journey) return (
        <Scene id="S14" {...journeyCopy.S14} body="내 기록이 어디에 있고, 떠날 때 무엇이 달라지는지 한눈에 확인해요." tone="base" className="journey-settings surface">
          <section className="lifecycle-boundary-map" aria-labelledby="lifecycle-boundary-title">
            <div className="lifecycle-boundary-heading">
              <p className="eyebrow">데이터 경계</p>
              <h2 id="lifecycle-boundary-title">내 데이터가 머무는 곳</h2>
              <p>계정 기록, 이 브라우저 설정, 이번 방문의 입력·결과, 내 기기 파일은 각각 따로 관리돼요.</p>
            </div>
            <div className="lifecycle-boundary-grid">
              <article data-boundary="account"><strong data-scope-label="account">{dataScopeLabel("account")}</strong><span>기록 · 계정 My Space</span></article>
              <article data-boundary="browser"><strong data-scope-label="browser">{dataScopeLabel("browser")}</strong><span>테마 · 시작 화면 · 동반자 · 브라우저 My Space</span></article>
              <article data-boundary="transient"><strong data-scope-label="visit">{dataScopeLabel("visit")}</strong><span>Model V2 입력 · 결과 · 이탈·새로고침 시 사라짐</span></article>
              <article data-boundary="device"><strong data-scope-label="device-file">{dataScopeLabel("deviceFile")}</strong><span>JSON · PDF · 인쇄물</span></article>
            </div>
          </section>
          <div className="journey-settings-list">
            <section className="journey-settings-group" aria-labelledby="settings-records-title">
              <div className="journey-settings-group-heading"><p className="journey-settings-scope" data-scope-label="account">{dataScopeLabel("account")}</p><h2 id="settings-records-title">계정에 저장되는 것</h2></div>
              <div className="journey-settings-group-content">
                <section className="journey-settings-section journey-settings-data-row">
                  <div className="section-header"><h3>혈압 관찰 · 챌린지 기록</h3><p>각 기록은 저장한 시점부터 30일 후 접근할 수 없게 돼요. 7일 돌아보기의 화면 구간과는 다른 기준이에요.</p></div>
                  <button className="secondary" type="button" onClick={() => onOpenRecap()} disabled={settingsControlsDisabled}>7일 기록 보기</button>
                </section>
                <section className="journey-settings-section journey-settings-data-row">
                  <div className="section-header"><h3>계정 My Space</h3><p>꾸미기 상태는 기록의 30일 보관 대상이 아니며, 이메일 로그인 계정이 유지되는 동안 남아요.</p></div>
                </section>
              </div>
            </section>
            <section className="journey-settings-group" aria-labelledby="settings-copies-title">
              <div className="journey-settings-group-heading"><p className="journey-settings-scope" data-scope-label="device-file">{dataScopeLabel("deviceFile")}</p><h2 id="settings-copies-title">내 기기의 사본</h2></div>
              <div className="journey-settings-group-content">
                <section className="journey-settings-section journey-settings-data-row lifecycle-export-row">
                  <div className="section-header"><h3>최근 30일 JSON</h3><p><time dateTime={shiftDate(today, -29)}>{shiftDate(today, -29)}</time>–<time dateTime={today}>{today}</time>의 30개 달력 날짜에서 현재 접근 가능한 혈압 관찰 기록만 포함해요.</p><p className="journey-settings-note">전체 계정 백업이 아니며, 삭제·만료된 기록은 복구하지 않아요. 날짜 범위와 기록별 30일 보관 기간은 별개예요.</p></div>
                  <button type="button" onClick={() => void onExportRecentThirtyDays()} disabled={settingsControlsDisabled} aria-busy={exportPending}>{exportPending ? "내보내는 중" : "최근 30일 JSON 내려받기"}</button>
                </section>
                <section className="journey-settings-section journey-settings-data-row">
                  <div className="section-header"><h3>7일 리포트 / PDF</h3><p>현재·이전·종료된 7일 리포트를 7일 돌아보기에서 확인하고 PDF로 저장할 수 있어요.</p></div>
                  <button className="secondary" type="button" onClick={() => onOpenRecap()} disabled={settingsControlsDisabled}>7일 리포트 / PDF 보기</button>
                </section>
                <p className="lifecycle-copy-note">내려받은 JSON, 저장한 PDF, 인쇄물은 내 기기에서 직접 관리해요. 로그아웃이나 계정 삭제로 자동 삭제되지 않아요.</p>
              </div>
            </section>
            <section className="journey-settings-group" aria-labelledby="settings-personal-title">
              <div className="journey-settings-group-heading"><h2 id="settings-personal-title">이 브라우저의 개인화</h2><p className="journey-settings-scope" data-scope-label="browser">{dataScopeLabel("browser")}</p></div>
              <div className="journey-settings-group-content">
                <section className="journey-settings-section journey-settings-display">
                  <div className="section-header"><h3>화면 테마</h3></div>
                  <fieldset className="theme-preset-control">
                    <legend>화면 테마</legend>
                    {themePreferenceOptions.map((option) => <label key={option.value}>
                      <input type="radio" name="sk7-theme-preset" value={option.value} checked={themePreference === option.value}
                        onChange={(event) => onThemeChange(event.target.value)} />
                      <span><strong>{option.label}</strong><small>{option.description}</small></span>
                    </label>)}
                  </fieldset>
                </section>
                {!evidenceMode && <StartingHomeControl key={browserPersonalizationVersion} headingLevel={3} compact />}
                {showCompanionSettings && <section className="journey-settings-section companion-identity-settings">
                  <div className="section-header"><h3>내 동반자</h3></div>
                  <label className="companion-identity-control" htmlFor="companion-species"><span>캐릭터 선택</span><select id="companion-species" value={companionSpeciesPreference} onChange={(event) => onCompanionSpeciesChange(event.target.value as CompanionSpecies)}>{companionIdentityOptions.map((option) => <option key={option.species} value={option.species}>{option.label}</option>)}</select></label>
                </section>}
                {!evidenceMode && <section className="journey-settings-section journey-settings-browser-reset">
                  <div className="section-header"><h3>개인화 초기화</h3><p>테마·시작 화면·동반자·브라우저 My Space를 기본값으로 되돌려요. 계정과 서버 기록은 변경하지 않아요.</p></div>
                  <button className="secondary" type="button" onClick={onResetBrowserPersonalization} disabled={settingsControlsDisabled}>초기화 범위 확인</button>
                </section>}
              </div>
            </section>
            {!evidenceMode && <section className="journey-settings-group journey-settings-signout" aria-labelledby="settings-signout-title">
              <div className="journey-settings-group-heading"><h2 id="settings-signout-title">이 기기에서 로그아웃</h2></div>
              <div className="journey-settings-group-content"><div className="journey-settings-account-row"><div className="section-header"><p className="journey-settings-primary-fact">로그아웃해도 계정과 서버 기록은 삭제되지 않아요.</p><p>공용 기기라면 사용을 마친 뒤 로그아웃해 주세요.</p></div><button className="secondary" type="button" onClick={() => void onSignOut()} disabled={signOutPending || accountDeletionPending} aria-busy={signOutPending}>{signOutPending ? "로그아웃 중" : "이 기기에서 로그아웃"}</button></div></div>
            </section>}
            <section className="journey-settings-group journey-settings-account" aria-labelledby="settings-account-title">
              <div className="journey-settings-group-heading"><p className="eyebrow">되돌릴 수 없는 작업</p><p className="journey-settings-scope" data-scope-label="account">{dataScopeLabel("account")}</p><h2 id="settings-account-title">계정 삭제</h2></div>
              <div className="journey-settings-group-content journey-settings-account-actions"><div className="journey-settings-account-row journey-settings-account-danger"><div className="journey-settings-deletion-facts"><p><strong>삭제됨</strong><span><span data-scope-label="account">{dataScopeLabel("account")}</span> · Auth 사용자 · 계정 소유 제품 기록 · 계정 My Space 꾸미기 상태</span></p><p><strong>자동 삭제되지 않음</strong><span><span data-scope-label="browser">{dataScopeLabel("browser")}</span> · 개인화 · <span data-scope-label="device-file">{dataScopeLabel("deviceFile")}</span></span></p></div><button className="danger" type="button" onClick={onRequestAccountDeletion} disabled={settingsControlsDisabled}>계정 삭제</button></div></div>
            </section>
          </div>
        </Scene>
      );
      return <Scene id="S14" {...journeyCopy.S14} tone="base" className="surface"><div className="settings-list"><section><div className="section-header"><p className="eyebrow">데이터 경계</p><h2>{dataScopeLabel("account")} · {dataScopeLabel("browser")} · {dataScopeLabel("visit")} · {dataScopeLabel("deviceFile")}</h2><p>계정 기록과 계정 My Space는 계정에, 화면 개인화는 이 브라우저에만 저장돼요. Model V2 입력과 결과는 이번 방문에만 쓰고, JSON·PDF·인쇄물은 내 기기 파일로 직접 관리해요.</p></div></section><section><div className="section-header"><p className="eyebrow">내 기록</p><h2>계정에 저장되는 것</h2><p>혈압 관찰과 챌린지 기록은 저장 시점부터 30일, 계정 My Space는 별도 계정 수명 주기를 따라요.</p></div><button className="secondary" type="button" onClick={() => onOpenRecap()}>7일 기록 보기</button></section><section><div className="section-header"><p className="eyebrow" data-scope-label="device-file">{dataScopeLabel("deviceFile")}</p><h2>최근 30일 날짜 범위 JSON</h2><p>{shiftDate(today, -29)}부터 {today}까지 현재 접근 가능한 기록 사본이며 전체 계정 백업이 아니에요.</p></div><button type="button" onClick={() => void onExportRecentThirtyDays()} disabled={settingsControlsDisabled}>{exportPending ? "내보내는 중" : "최근 30일 날짜 범위 JSON 내려받기"}</button></section>{!evidenceMode && <StartingHomeControl key={browserPersonalizationVersion} />}<section><div className="section-header"><p className="eyebrow" data-scope-label="browser">{dataScopeLabel("browser")}</p><h2>브라우저에만 저장</h2><p>테마, 시작 화면, 동반자, browser-only My Space는 계정과 자동 병합되지 않아요.</p></div><button className="secondary" type="button" onClick={onResetBrowserPersonalization}>개인화 초기화</button></section>{!evidenceMode && <section><div className="section-header"><p className="eyebrow">이 기기에서 로그아웃</p><h2>현재 계정 연결 끝내기</h2><p>계정, 서버 기록, 브라우저 개인화, 내려받은 파일은 삭제하지 않아요.</p></div><button className="secondary" type="button" onClick={() => void onSignOut()} disabled={signOutPending || accountDeletionPending}>{signOutPending ? "로그아웃 중" : "이 기기에서 로그아웃"}</button></section>}<section><div className="section-header"><p className="eyebrow" data-scope-label="account">{dataScopeLabel("account")}</p><h2>삭제 범위 확인</h2><p>계정과 계정 소유 서버 데이터는 삭제되지만 이 브라우저 개인화와 내 기기 파일은 남을 수 있어요.</p></div><button className="danger" type="button" onClick={onRequestAccountDeletion} disabled={settingsControlsDisabled}>계정 삭제</button></section></div></Scene>;
}
