export type LanguageCode = "en" | "zh" | "es" | "fr" | "de" | "ja" | "ko" | "pt";

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "pt", label: "Português" },
];

type Dict = Record<string, string>;

const en: Dict = {
  // Tabs
  "tab.markets": "Markets",
  "tab.trade": "Trade",
  "tab.wallet": "Wallet",
  "tab.earn": "Earn",
  "tab.notifications": "Alerts",

  // Common
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.continue": "Continue",
  "common.save": "Save",
  "common.back": "Back",
  "common.close": "Close",
  "common.error": "Error",
  "common.success": "Success",
  "common.loading": "Loading…",
  "common.required": "Required",
  "common.signIn": "Sign In",
  "common.signOut": "Sign Out",

  // Greeting
  "greeting.hello": "Hello",
  "greeting.helloName": "Hello, {name}",
  "greeting.live": "Live",
  "greeting.connecting": "Connecting...",

  // Settings — sections
  "settings.title": "Settings",
  "settings.section.account": "ACCOUNT",
  "settings.section.preferences": "PREFERENCES",
  "settings.section.security": "SECURITY",
  "settings.section.linkedAccounts": "LINKED ACCOUNTS",
  "settings.section.exchanges": "EXCHANGE CONNECTIONS",
  "settings.section.notifications": "NOTIFICATIONS",
  "settings.section.support": "SUPPORT",
  "settings.section.legal": "LEGAL",

  // Settings — rows
  "settings.row.displayName": "Display Name",
  "settings.row.email": "Email",
  "settings.row.phone": "Phone",
  "settings.row.currency": "Currency",
  "settings.row.language": "Language",
  "settings.row.theme": "Dark Mode",
  "settings.row.twoFactor": "Two-Factor Auth",
  "settings.row.backupCodes": "Backup Codes",
  "settings.row.changePassword": "Change Password",
  "settings.row.loginHistory": "Login History",
  "settings.row.notifications": "Push Notifications",
  "settings.row.priceAlerts": "Price Alerts",
  "settings.row.support": "Help & Support",
  "settings.row.terms": "Terms of Service",
  "settings.row.privacy": "Privacy Policy",
  "settings.row.signOut": "Sign Out",

  // Settings — values / states
  "settings.value.enabled": "Enabled",
  "settings.value.disabled": "Disabled",
  "settings.value.linked": "Linked",
  "settings.value.notLinked": "Not Linked",
  "settings.value.entries": "{n} entries",
  "settings.value.codesLeft": "{n} left",

  // Pickers
  "picker.language": "Language",
  "picker.currency": "Currency",

  // Login history
  "loginHistory.title": "Login History",
  "loginHistory.empty": "No login activity recorded yet.",
  "loginHistory.success": "Success",
  "loginHistory.failed": "Failed",
  "loginHistory.ip": "IP {ip}",

  // Withdraw
  "withdraw.title": "Withdraw Crypto",
  "withdraw.titleCoin": "Withdraw {coin}",
  "withdraw.network": "NETWORK",
  "withdraw.address": "WITHDRAWAL ADDRESS",
  "withdraw.amount": "AMOUNT",
  "withdraw.available": "Available",
  "withdraw.networkFee": "Network Fee",
  "withdraw.expectedArrival": "Expected Arrival",
  "withdraw.continue": "Continue",
  "withdraw.continueTo2FA": "Continue to 2FA",
  "withdraw.warning": "Withdrawals are processed within 24 hours. Always verify the destination address and network — crypto transactions cannot be reversed.",
  "withdraw.twofa.title": "Two-Factor Authentication",
  "withdraw.twofa.heading": "Verify it's you",
  "withdraw.twofa.subtitle": "Open your authenticator app and enter the 6-digit code to authorize this withdrawal of {amount} {coin}.",
  "withdraw.twofa.field": "AUTHENTICATION CODE",
  "withdraw.twofa.help": "Lost your device? Enter one of your backup codes.",
  "withdraw.twofa.invalid": "Invalid code. Try again or use a backup code.",
  "withdraw.twofa.button": "Verify & Withdraw",
};

const translations: Record<LanguageCode, Dict> = {
  en,
  zh: {
    "tab.markets": "市场", "tab.trade": "交易", "tab.wallet": "钱包", "tab.earn": "理财", "tab.notifications": "通知",
    "common.cancel": "取消", "common.confirm": "确认", "common.continue": "继续", "common.save": "保存", "common.back": "返回", "common.close": "关闭", "common.error": "错误", "common.success": "成功", "common.loading": "加载中…", "common.required": "必填", "common.signIn": "登录", "common.signOut": "退出登录",
    "greeting.hello": "你好", "greeting.helloName": "你好，{name}", "greeting.live": "实时", "greeting.connecting": "连接中...",
    "settings.title": "设置",
    "settings.section.account": "账户", "settings.section.preferences": "偏好设置", "settings.section.security": "安全", "settings.section.linkedAccounts": "关联账户", "settings.section.exchanges": "交易所连接", "settings.section.notifications": "通知", "settings.section.support": "支持", "settings.section.legal": "法律",
    "settings.row.displayName": "显示名称", "settings.row.email": "邮箱", "settings.row.phone": "手机号", "settings.row.currency": "货币", "settings.row.language": "语言", "settings.row.theme": "深色模式", "settings.row.twoFactor": "两步验证", "settings.row.backupCodes": "备用码", "settings.row.changePassword": "修改密码", "settings.row.loginHistory": "登录历史", "settings.row.notifications": "推送通知", "settings.row.priceAlerts": "价格提醒", "settings.row.support": "帮助与支持", "settings.row.terms": "服务条款", "settings.row.privacy": "隐私政策", "settings.row.signOut": "退出登录",
    "settings.value.enabled": "已开启", "settings.value.disabled": "未开启", "settings.value.linked": "已关联", "settings.value.notLinked": "未关联", "settings.value.entries": "{n} 条记录", "settings.value.codesLeft": "剩余 {n} 个",
    "picker.language": "语言", "picker.currency": "货币",
    "loginHistory.title": "登录历史", "loginHistory.empty": "暂无登录记录。", "loginHistory.success": "成功", "loginHistory.failed": "失败", "loginHistory.ip": "IP {ip}",
    "withdraw.title": "提币", "withdraw.titleCoin": "提取 {coin}", "withdraw.network": "网络", "withdraw.address": "提币地址", "withdraw.amount": "数量", "withdraw.available": "可用", "withdraw.networkFee": "网络费用", "withdraw.expectedArrival": "预计到账", "withdraw.continue": "继续", "withdraw.continueTo2FA": "继续验证 2FA",
    "withdraw.warning": "提币将在 24 小时内处理。请务必核对目标地址和网络——加密货币交易无法撤销。",
    "withdraw.twofa.title": "两步验证", "withdraw.twofa.heading": "验证身份", "withdraw.twofa.subtitle": "请打开验证器应用并输入 6 位代码以授权本次提币 {amount} {coin}。", "withdraw.twofa.field": "验证码", "withdraw.twofa.help": "丢失设备？请使用一个备用码。", "withdraw.twofa.invalid": "验证码错误，请重试或使用备用码。", "withdraw.twofa.button": "验证并提币",
  },
  es: {
    "tab.markets": "Mercados", "tab.trade": "Operar", "tab.wallet": "Cartera", "tab.earn": "Ganar", "tab.notifications": "Alertas",
    "common.cancel": "Cancelar", "common.confirm": "Confirmar", "common.continue": "Continuar", "common.save": "Guardar", "common.back": "Atrás", "common.close": "Cerrar", "common.error": "Error", "common.success": "Éxito", "common.loading": "Cargando…", "common.required": "Requerido", "common.signIn": "Iniciar sesión", "common.signOut": "Cerrar sesión",
    "greeting.hello": "Hola", "greeting.helloName": "Hola, {name}", "greeting.live": "En vivo", "greeting.connecting": "Conectando...",
    "settings.title": "Ajustes",
    "settings.section.account": "CUENTA", "settings.section.preferences": "PREFERENCIAS", "settings.section.security": "SEGURIDAD", "settings.section.linkedAccounts": "CUENTAS VINCULADAS", "settings.section.exchanges": "CONEXIONES DE EXCHANGE", "settings.section.notifications": "NOTIFICACIONES", "settings.section.support": "SOPORTE", "settings.section.legal": "LEGAL",
    "settings.row.displayName": "Nombre", "settings.row.email": "Correo", "settings.row.phone": "Teléfono", "settings.row.currency": "Moneda", "settings.row.language": "Idioma", "settings.row.theme": "Modo oscuro", "settings.row.twoFactor": "Autenticación 2FA", "settings.row.backupCodes": "Códigos de respaldo", "settings.row.changePassword": "Cambiar contraseña", "settings.row.loginHistory": "Historial de accesos", "settings.row.notifications": "Notificaciones push", "settings.row.priceAlerts": "Alertas de precio", "settings.row.support": "Ayuda y soporte", "settings.row.terms": "Términos del servicio", "settings.row.privacy": "Política de privacidad", "settings.row.signOut": "Cerrar sesión",
    "settings.value.enabled": "Activado", "settings.value.disabled": "Desactivado", "settings.value.linked": "Vinculado", "settings.value.notLinked": "No vinculado", "settings.value.entries": "{n} entradas", "settings.value.codesLeft": "{n} restantes",
    "picker.language": "Idioma", "picker.currency": "Moneda",
    "loginHistory.title": "Historial de accesos", "loginHistory.empty": "Aún no hay actividad registrada.", "loginHistory.success": "Éxito", "loginHistory.failed": "Fallido", "loginHistory.ip": "IP {ip}",
    "withdraw.title": "Retirar cripto", "withdraw.titleCoin": "Retirar {coin}", "withdraw.network": "RED", "withdraw.address": "DIRECCIÓN DE RETIRO", "withdraw.amount": "CANTIDAD", "withdraw.available": "Disponible", "withdraw.networkFee": "Comisión de red", "withdraw.expectedArrival": "Llegada estimada", "withdraw.continue": "Continuar", "withdraw.continueTo2FA": "Continuar a 2FA",
    "withdraw.warning": "Los retiros se procesan en 24 horas. Verifica siempre la dirección y la red — las transacciones cripto no se pueden revertir.",
    "withdraw.twofa.title": "Autenticación de dos factores", "withdraw.twofa.heading": "Verifica tu identidad", "withdraw.twofa.subtitle": "Abre tu app de autenticación e introduce el código de 6 dígitos para autorizar este retiro de {amount} {coin}.", "withdraw.twofa.field": "CÓDIGO DE AUTENTICACIÓN", "withdraw.twofa.help": "¿Perdiste el dispositivo? Usa uno de tus códigos de respaldo.", "withdraw.twofa.invalid": "Código inválido. Inténtalo de nuevo o usa un código de respaldo.", "withdraw.twofa.button": "Verificar y retirar",
  },
  fr: {
    "tab.markets": "Marchés", "tab.trade": "Trader", "tab.wallet": "Portefeuille", "tab.earn": "Gagner", "tab.notifications": "Alertes",
    "common.cancel": "Annuler", "common.confirm": "Confirmer", "common.continue": "Continuer", "common.save": "Enregistrer", "common.back": "Retour", "common.close": "Fermer", "common.error": "Erreur", "common.success": "Succès", "common.loading": "Chargement…", "common.required": "Requis", "common.signIn": "Se connecter", "common.signOut": "Se déconnecter",
    "greeting.hello": "Bonjour", "greeting.helloName": "Bonjour, {name}", "greeting.live": "En direct", "greeting.connecting": "Connexion...",
    "settings.title": "Paramètres",
    "settings.section.account": "COMPTE", "settings.section.preferences": "PRÉFÉRENCES", "settings.section.security": "SÉCURITÉ", "settings.section.linkedAccounts": "COMPTES LIÉS", "settings.section.exchanges": "CONNEXIONS EXCHANGE", "settings.section.notifications": "NOTIFICATIONS", "settings.section.support": "ASSISTANCE", "settings.section.legal": "MENTIONS LÉGALES",
    "settings.row.displayName": "Nom d'affichage", "settings.row.email": "E-mail", "settings.row.phone": "Téléphone", "settings.row.currency": "Devise", "settings.row.language": "Langue", "settings.row.theme": "Mode sombre", "settings.row.twoFactor": "Authentification 2FA", "settings.row.backupCodes": "Codes de secours", "settings.row.changePassword": "Changer le mot de passe", "settings.row.loginHistory": "Historique de connexion", "settings.row.notifications": "Notifications push", "settings.row.priceAlerts": "Alertes de prix", "settings.row.support": "Aide & Support", "settings.row.terms": "Conditions d'utilisation", "settings.row.privacy": "Politique de confidentialité", "settings.row.signOut": "Se déconnecter",
    "settings.value.enabled": "Activé", "settings.value.disabled": "Désactivé", "settings.value.linked": "Lié", "settings.value.notLinked": "Non lié", "settings.value.entries": "{n} entrées", "settings.value.codesLeft": "{n} restants",
    "picker.language": "Langue", "picker.currency": "Devise",
    "loginHistory.title": "Historique de connexion", "loginHistory.empty": "Aucune activité enregistrée.", "loginHistory.success": "Succès", "loginHistory.failed": "Échec", "loginHistory.ip": "IP {ip}",
    "withdraw.title": "Retirer des cryptos", "withdraw.titleCoin": "Retirer {coin}", "withdraw.network": "RÉSEAU", "withdraw.address": "ADRESSE DE RETRAIT", "withdraw.amount": "MONTANT", "withdraw.available": "Disponible", "withdraw.networkFee": "Frais de réseau", "withdraw.expectedArrival": "Arrivée estimée", "withdraw.continue": "Continuer", "withdraw.continueTo2FA": "Continuer vers 2FA",
    "withdraw.warning": "Les retraits sont traités sous 24 heures. Vérifiez toujours l'adresse et le réseau — les transactions crypto sont irréversibles.",
    "withdraw.twofa.title": "Authentification à deux facteurs", "withdraw.twofa.heading": "Vérifiez votre identité", "withdraw.twofa.subtitle": "Ouvrez votre application d'authentification et saisissez le code à 6 chiffres pour autoriser ce retrait de {amount} {coin}.", "withdraw.twofa.field": "CODE D'AUTHENTIFICATION", "withdraw.twofa.help": "Appareil perdu ? Saisissez un code de secours.", "withdraw.twofa.invalid": "Code invalide. Réessayez ou utilisez un code de secours.", "withdraw.twofa.button": "Vérifier & retirer",
  },
  de: {
    "tab.markets": "Märkte", "tab.trade": "Handel", "tab.wallet": "Wallet", "tab.earn": "Verdienen", "tab.notifications": "Benachrichtigungen",
    "common.cancel": "Abbrechen", "common.confirm": "Bestätigen", "common.continue": "Weiter", "common.save": "Speichern", "common.back": "Zurück", "common.close": "Schließen", "common.error": "Fehler", "common.success": "Erfolg", "common.loading": "Lädt…", "common.required": "Erforderlich", "common.signIn": "Anmelden", "common.signOut": "Abmelden",
    "greeting.hello": "Hallo", "greeting.helloName": "Hallo, {name}", "greeting.live": "Live", "greeting.connecting": "Verbindung...",
    "settings.title": "Einstellungen",
    "settings.section.account": "KONTO", "settings.section.preferences": "EINSTELLUNGEN", "settings.section.security": "SICHERHEIT", "settings.section.linkedAccounts": "VERKNÜPFTE KONTEN", "settings.section.exchanges": "EXCHANGE-VERBINDUNGEN", "settings.section.notifications": "BENACHRICHTIGUNGEN", "settings.section.support": "SUPPORT", "settings.section.legal": "RECHTLICHES",
    "settings.row.displayName": "Anzeigename", "settings.row.email": "E-Mail", "settings.row.phone": "Telefon", "settings.row.currency": "Währung", "settings.row.language": "Sprache", "settings.row.theme": "Dunkler Modus", "settings.row.twoFactor": "Zwei-Faktor-Auth", "settings.row.backupCodes": "Backup-Codes", "settings.row.changePassword": "Passwort ändern", "settings.row.loginHistory": "Login-Verlauf", "settings.row.notifications": "Push-Benachrichtigungen", "settings.row.priceAlerts": "Preisalarme", "settings.row.support": "Hilfe & Support", "settings.row.terms": "Nutzungsbedingungen", "settings.row.privacy": "Datenschutzerklärung", "settings.row.signOut": "Abmelden",
    "settings.value.enabled": "Aktiviert", "settings.value.disabled": "Deaktiviert", "settings.value.linked": "Verknüpft", "settings.value.notLinked": "Nicht verknüpft", "settings.value.entries": "{n} Einträge", "settings.value.codesLeft": "{n} übrig",
    "picker.language": "Sprache", "picker.currency": "Währung",
    "loginHistory.title": "Login-Verlauf", "loginHistory.empty": "Noch keine Aktivität.", "loginHistory.success": "Erfolg", "loginHistory.failed": "Fehlgeschlagen", "loginHistory.ip": "IP {ip}",
    "withdraw.title": "Krypto auszahlen", "withdraw.titleCoin": "{coin} auszahlen", "withdraw.network": "NETZWERK", "withdraw.address": "AUSZAHLUNGSADRESSE", "withdraw.amount": "BETRAG", "withdraw.available": "Verfügbar", "withdraw.networkFee": "Netzwerkgebühr", "withdraw.expectedArrival": "Voraussichtliche Ankunft", "withdraw.continue": "Weiter", "withdraw.continueTo2FA": "Weiter zu 2FA",
    "withdraw.warning": "Auszahlungen werden innerhalb von 24 Stunden bearbeitet. Bitte Adresse und Netzwerk prüfen — Krypto-Transaktionen sind unwiderruflich.",
    "withdraw.twofa.title": "Zwei-Faktor-Authentifizierung", "withdraw.twofa.heading": "Identität bestätigen", "withdraw.twofa.subtitle": "Öffne deine Authenticator-App und gib den 6-stelligen Code ein, um diese Auszahlung von {amount} {coin} zu autorisieren.", "withdraw.twofa.field": "AUTHENTIFIZIERUNGSCODE", "withdraw.twofa.help": "Gerät verloren? Verwende einen Backup-Code.", "withdraw.twofa.invalid": "Ungültiger Code. Bitte erneut versuchen oder Backup-Code verwenden.", "withdraw.twofa.button": "Prüfen & auszahlen",
  },
  ja: {
    "tab.markets": "マーケット", "tab.trade": "取引", "tab.wallet": "ウォレット", "tab.earn": "資産運用", "tab.notifications": "通知",
    "common.cancel": "キャンセル", "common.confirm": "確認", "common.continue": "続ける", "common.save": "保存", "common.back": "戻る", "common.close": "閉じる", "common.error": "エラー", "common.success": "成功", "common.loading": "読み込み中…", "common.required": "必須", "common.signIn": "ログイン", "common.signOut": "ログアウト",
    "greeting.hello": "こんにちは", "greeting.helloName": "こんにちは、{name}さん", "greeting.live": "ライブ", "greeting.connecting": "接続中...",
    "settings.title": "設定",
    "settings.section.account": "アカウント", "settings.section.preferences": "環境設定", "settings.section.security": "セキュリティ", "settings.section.linkedAccounts": "連携アカウント", "settings.section.exchanges": "取引所接続", "settings.section.notifications": "通知", "settings.section.support": "サポート", "settings.section.legal": "法的情報",
    "settings.row.displayName": "表示名", "settings.row.email": "メール", "settings.row.phone": "電話", "settings.row.currency": "通貨", "settings.row.language": "言語", "settings.row.theme": "ダークモード", "settings.row.twoFactor": "二段階認証", "settings.row.backupCodes": "バックアップコード", "settings.row.changePassword": "パスワード変更", "settings.row.loginHistory": "ログイン履歴", "settings.row.notifications": "プッシュ通知", "settings.row.priceAlerts": "価格アラート", "settings.row.support": "ヘルプ", "settings.row.terms": "利用規約", "settings.row.privacy": "プライバシーポリシー", "settings.row.signOut": "ログアウト",
    "settings.value.enabled": "有効", "settings.value.disabled": "無効", "settings.value.linked": "連携済み", "settings.value.notLinked": "未連携", "settings.value.entries": "{n} 件", "settings.value.codesLeft": "残り {n} 個",
    "picker.language": "言語", "picker.currency": "通貨",
    "loginHistory.title": "ログイン履歴", "loginHistory.empty": "ログイン記録はまだありません。", "loginHistory.success": "成功", "loginHistory.failed": "失敗", "loginHistory.ip": "IP {ip}",
    "withdraw.title": "暗号資産を出金", "withdraw.titleCoin": "{coin} を出金", "withdraw.network": "ネットワーク", "withdraw.address": "出金アドレス", "withdraw.amount": "数量", "withdraw.available": "利用可能", "withdraw.networkFee": "ネットワーク手数料", "withdraw.expectedArrival": "到着予定", "withdraw.continue": "続ける", "withdraw.continueTo2FA": "2FAへ進む",
    "withdraw.warning": "出金は24時間以内に処理されます。アドレスとネットワークを必ず確認してください — 暗号資産の取引は取り消せません。",
    "withdraw.twofa.title": "二段階認証", "withdraw.twofa.heading": "本人確認", "withdraw.twofa.subtitle": "認証アプリを開き、{amount} {coin} の出金を承認するために6桁のコードを入力してください。", "withdraw.twofa.field": "認証コード", "withdraw.twofa.help": "デバイスを紛失しましたか？バックアップコードを入力してください。", "withdraw.twofa.invalid": "無効なコードです。再試行またはバックアップコードをご利用ください。", "withdraw.twofa.button": "認証して出金",
  },
  ko: {
    "tab.markets": "마켓", "tab.trade": "거래", "tab.wallet": "지갑", "tab.earn": "수익", "tab.notifications": "알림",
    "common.cancel": "취소", "common.confirm": "확인", "common.continue": "계속", "common.save": "저장", "common.back": "뒤로", "common.close": "닫기", "common.error": "오류", "common.success": "성공", "common.loading": "로딩 중…", "common.required": "필수", "common.signIn": "로그인", "common.signOut": "로그아웃",
    "greeting.hello": "안녕하세요", "greeting.helloName": "안녕하세요, {name}님", "greeting.live": "실시간", "greeting.connecting": "연결 중...",
    "settings.title": "설정",
    "settings.section.account": "계정", "settings.section.preferences": "환경설정", "settings.section.security": "보안", "settings.section.linkedAccounts": "연결된 계정", "settings.section.exchanges": "거래소 연결", "settings.section.notifications": "알림", "settings.section.support": "지원", "settings.section.legal": "법적 고지",
    "settings.row.displayName": "표시 이름", "settings.row.email": "이메일", "settings.row.phone": "전화번호", "settings.row.currency": "통화", "settings.row.language": "언어", "settings.row.theme": "다크 모드", "settings.row.twoFactor": "2단계 인증", "settings.row.backupCodes": "백업 코드", "settings.row.changePassword": "비밀번호 변경", "settings.row.loginHistory": "로그인 기록", "settings.row.notifications": "푸시 알림", "settings.row.priceAlerts": "가격 알림", "settings.row.support": "도움말", "settings.row.terms": "이용약관", "settings.row.privacy": "개인정보 처리방침", "settings.row.signOut": "로그아웃",
    "settings.value.enabled": "사용 중", "settings.value.disabled": "사용 안 함", "settings.value.linked": "연결됨", "settings.value.notLinked": "연결 안 됨", "settings.value.entries": "{n}개 기록", "settings.value.codesLeft": "{n}개 남음",
    "picker.language": "언어", "picker.currency": "통화",
    "loginHistory.title": "로그인 기록", "loginHistory.empty": "기록된 활동이 없습니다.", "loginHistory.success": "성공", "loginHistory.failed": "실패", "loginHistory.ip": "IP {ip}",
    "withdraw.title": "암호화폐 출금", "withdraw.titleCoin": "{coin} 출금", "withdraw.network": "네트워크", "withdraw.address": "출금 주소", "withdraw.amount": "수량", "withdraw.available": "사용 가능", "withdraw.networkFee": "네트워크 수수료", "withdraw.expectedArrival": "예상 도착", "withdraw.continue": "계속", "withdraw.continueTo2FA": "2FA로 계속",
    "withdraw.warning": "출금은 24시간 내에 처리됩니다. 주소와 네트워크를 반드시 확인하세요 — 암호화폐 거래는 되돌릴 수 없습니다.",
    "withdraw.twofa.title": "2단계 인증", "withdraw.twofa.heading": "본인 확인", "withdraw.twofa.subtitle": "인증 앱을 열고 {amount} {coin} 출금을 승인하기 위한 6자리 코드를 입력하세요.", "withdraw.twofa.field": "인증 코드", "withdraw.twofa.help": "기기를 분실했나요? 백업 코드를 사용하세요.", "withdraw.twofa.invalid": "잘못된 코드입니다. 다시 시도하거나 백업 코드를 사용하세요.", "withdraw.twofa.button": "확인 후 출금",
  },
  pt: {
    "tab.markets": "Mercados", "tab.trade": "Negociar", "tab.wallet": "Carteira", "tab.earn": "Render", "tab.notifications": "Alertas",
    "common.cancel": "Cancelar", "common.confirm": "Confirmar", "common.continue": "Continuar", "common.save": "Salvar", "common.back": "Voltar", "common.close": "Fechar", "common.error": "Erro", "common.success": "Sucesso", "common.loading": "Carregando…", "common.required": "Obrigatório", "common.signIn": "Entrar", "common.signOut": "Sair",
    "greeting.hello": "Olá", "greeting.helloName": "Olá, {name}", "greeting.live": "Ao vivo", "greeting.connecting": "Conectando...",
    "settings.title": "Configurações",
    "settings.section.account": "CONTA", "settings.section.preferences": "PREFERÊNCIAS", "settings.section.security": "SEGURANÇA", "settings.section.linkedAccounts": "CONTAS VINCULADAS", "settings.section.exchanges": "CONEXÕES DE EXCHANGE", "settings.section.notifications": "NOTIFICAÇÕES", "settings.section.support": "SUPORTE", "settings.section.legal": "LEGAL",
    "settings.row.displayName": "Nome de exibição", "settings.row.email": "E-mail", "settings.row.phone": "Telefone", "settings.row.currency": "Moeda", "settings.row.language": "Idioma", "settings.row.theme": "Modo escuro", "settings.row.twoFactor": "Autenticação 2FA", "settings.row.backupCodes": "Códigos de backup", "settings.row.changePassword": "Alterar senha", "settings.row.loginHistory": "Histórico de acessos", "settings.row.notifications": "Notificações push", "settings.row.priceAlerts": "Alertas de preço", "settings.row.support": "Ajuda & Suporte", "settings.row.terms": "Termos de Serviço", "settings.row.privacy": "Política de Privacidade", "settings.row.signOut": "Sair",
    "settings.value.enabled": "Ativado", "settings.value.disabled": "Desativado", "settings.value.linked": "Vinculado", "settings.value.notLinked": "Não vinculado", "settings.value.entries": "{n} registros", "settings.value.codesLeft": "{n} restantes",
    "picker.language": "Idioma", "picker.currency": "Moeda",
    "loginHistory.title": "Histórico de acessos", "loginHistory.empty": "Nenhuma atividade registrada.", "loginHistory.success": "Sucesso", "loginHistory.failed": "Falhou", "loginHistory.ip": "IP {ip}",
    "withdraw.title": "Sacar Cripto", "withdraw.titleCoin": "Sacar {coin}", "withdraw.network": "REDE", "withdraw.address": "ENDEREÇO DE SAQUE", "withdraw.amount": "QUANTIDADE", "withdraw.available": "Disponível", "withdraw.networkFee": "Taxa de rede", "withdraw.expectedArrival": "Chegada estimada", "withdraw.continue": "Continuar", "withdraw.continueTo2FA": "Continuar para 2FA",
    "withdraw.warning": "Saques são processados em 24 horas. Confirme sempre o endereço e a rede — transações cripto não podem ser revertidas.",
    "withdraw.twofa.title": "Autenticação de Dois Fatores", "withdraw.twofa.heading": "Verifique sua identidade", "withdraw.twofa.subtitle": "Abra seu app autenticador e digite o código de 6 dígitos para autorizar este saque de {amount} {coin}.", "withdraw.twofa.field": "CÓDIGO DE AUTENTICAÇÃO", "withdraw.twofa.help": "Perdeu o dispositivo? Use um dos códigos de backup.", "withdraw.twofa.invalid": "Código inválido. Tente novamente ou use um código de backup.", "withdraw.twofa.button": "Verificar e sacar",
  },
};

export function isLanguageCode(v: string | undefined | null): v is LanguageCode {
  return !!v && (LANGUAGES.some((l) => l.code === v));
}

export function translate(lang: LanguageCode | string | undefined, key: string, vars?: Record<string, string | number>): string {
  const code: LanguageCode = isLanguageCode(lang) ? lang : "en";
  const dict = translations[code] ?? en;
  let value = dict[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return value;
}
