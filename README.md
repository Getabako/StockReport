# Stock Report

監視したいティッカーと関心テーマを 1 回登録すれば、ボタン 1 つで Codex が最新の株価データ + ニュースを取りに行って **日次マーケットレポート HTML** を生成します。OpenAI API キー不要（Codex 自身が分析）、株価は `yfinance`（無料）、ニュースは RSS。過去レポートも残るのでダッシュボードとして使えます。

## 使い方（友達に渡すのはこの 1 行）

### Mac

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Getabako/StockReport/main/install.sh)"
```

### Windows

```
iwr -useb https://raw.githubusercontent.com/Getabako/StockReport/main/install.ps1 | iex
```

---

初回は Node / Codex CLI / git / Python（+ yfinance, matplotlib, feedparser）を自動インストール。ChatGPT のログイン画面が出たらサインインしてください。

URL がターミナルに表示されるので、ブラウザに貼って開いてください（自動オープンしません）。終了は **Ctrl+C**。

## 機能

- **設定 1 回**: ティッカー / テーマ / RSS / 観点を登録
- **🔄 今最新にする**: 1 クリックで Codex が yfinance + RSS を取得 → 分析 → HTML レポート生成
- **チャート同梱**: matplotlib で銘柄ごとの折れ線
- **過去レポート保管**: `~/.stockreport-data/reports/<id>/` に永続保存
- **オフライン読み返し**: ZIP DL すればローカルでも見れる

## 動作要件

- macOS / Windows 10/11
- ChatGPT Plus / Pro / Business / Enterprise
- 株価データは `yfinance` 由来（一部市場・遅延データの可能性あり）
