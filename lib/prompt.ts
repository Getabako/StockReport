export type StockSettings = {
  tickers: string[];
  themes: string[];
  rssFeeds: string[];
  focus: string;
};

export function buildCodexPrompt(s: StockSettings, reportId: string): string {
  const tickersStr = s.tickers.length ? s.tickers.join(", ") : "(なし)";
  const themesStr  = s.themes.length  ? s.themes.join(", ") : "(なし)";
  const rssStr     = s.rssFeeds.length ? s.rssFeeds.map(f => "- " + f).join("\n") : "- (任意でユーザーが追加)";

  return `# あなたへの作業指示

あなたは熟練の金融・テックアナリストです。
現在のディレクトリ (cwd) を作業場として、**日本語の日次マーケットレポート HTML** を生成してください。

# 🚨 ツール使用ルール（絶対）

- 外部 API キー (OPENAI_API_KEY, GEMINI_API_KEY, ALPHA_VANTAGE 等) は **使用禁止**。
- 株価データは **yfinance**（無料・キー不要）を Python 経由で取得。
- ニュース取得は **RSS / 公開 HTML を curl / Python feedparser** で取得。
- AI 分析・要約・所感は **あなた自身 (Codex)** が行う。外部 LLM API は呼ばない。
- 画像（チャート）は **matplotlib** で生成し \`./charts/<ticker>.png\` に保存。

# レポート内容

## 監視ティッカー
${tickersStr}

## 関心テーマ
${themesStr}

## 追加 RSS フィード
${rssStr}

## 重視する観点
${s.focus || "全般的なトレンド・ニュース・売買シグナルのバランス"}

# 作業手順

1. \`mkdir -p charts\`
2. Python 環境確認: \`python3 -c "import yfinance, matplotlib, feedparser"\` がエラーなら \`pip3 install --user yfinance matplotlib feedparser\` で揃える
3. 各ティッカーで:
   - yfinance で過去 1 ヶ月の日足を取得
   - matplotlib で終値折れ線を \`./charts/<TICKER>.png\` に保存
   - 直近の値動き / 出来高 / 52w high/low / 簡単な所感を抽出
4. RSS / IR フィードを取得し、関心テーマに該当する記事のタイトル + URL + 要約（あなたが日本語で 2〜3 行）を抜き出す
5. **report.html** を ./ に書き出す:
   - Tailwind CSS の CDN (https://cdn.tailwindcss.com) のみ外部利用可
   - CSS / JS は <style> <script> でインライン化
   - 構成: ヘッダー（生成日時 + ${reportId}） / マーケットサマリー / ティッカー別カード (チャート img + 数字 + 所感) / ニュースダイジェスト / 観点まとめ / フッター
   - 画像は \`<img src="charts/AAPL.png">\` 等の相対パスで
   - レスポンシブ (360〜1440px)
   - 日本語、ダーク基調 (#0f172a + アクセント #22d3ee)
6. 生データを **data.json** に保存
7. 完了報告は 1〜2 行で

# 🚨 重要

- HTML/コードを会話に書かない。**\`apply_patch\` または \`cat > report.html << 'EOF'\` でファイルに書く**。
- 1 ティッカー失敗しても次へ。最後にどれが成功したか報告。
- 日付は JST で扱う。
`;
}
