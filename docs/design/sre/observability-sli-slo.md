# SRE SLO/SLI ＆ 可観測性（Observability）設計書

## 1. サービスレベル目標 (SLI / SLO)
システムの信頼性とパフォーマンスを定量的に担保するため、以下のSLI（サービスレベル指標）およびSLO（サービスレベル目標）を定めます。

| サービス領域 | SLI (指標定義) | SLO (目標値) | 測定ウィンドウ | エラーバジェット消費条件 |
| :--- | :--- | :--- | :--- | :--- |
| **API可用性** | 5xx以外の正常応答数 ÷ 全リクエスト数 | **99.9% 以上** | 過去30日間ローリング | 5xxエラー率が0.1%を超過 |
| **APIレイテンシ** | エンドポイント応答時間 (p95) | **< 300 ms** | 過去30日間ローリング | p95応答時間が300msを超過 |
| **AIツール呼出** | ツール実行成功率（タイムアウト除外） | **99.5% 以上** | 過去7日間ローリング | ツール内部障害による中断率超過 |
| **DB接続健全性** | コネクションプール枯渇発生時間 | **0 分 (100%)** | 過去30日間 | プール利用率100%の継続検知 |

---

## 2. 可観測性の3本柱 (Metrics / Logs / Traces) アーキテクチャ

```mermaid
flowchart TD
    App["Application (Backend / Agents)"] --> Telemetry["OpenTelemetry SDK"]

    Telemetry -->|Metrics (Counters, Latency)| CloudWatch["AWS CloudWatch Metrics"]
    Telemetry -->|Structured Logs (JSON)| CWLogs["CloudWatch Logs"]
    Telemetry -->|Distributed Traces (W3C)| XRay["AWS X-Ray / OTel Collector"]

    CloudWatch --> Dashboard["CloudWatch / Grafana Dashboard"]
    CloudWatch --> Alarms["CloudWatch Alarms"]
    Alarms --> SNS["Amazon SNS (PagerDuty / Slack)"]
```

---

## 3. 分散トレーシング設計 (OpenTelemetry 準拠)
- **Trace Context伝搬**:
  - 全ての受信HTTPリクエストから `traceparent` ヘッダー（W3C Trace Context）を抽出し、ない場合はバックエンド起点で新規発行。
- **スパン分割粒度**:
  1. `HTTP Server Span`: リクエスト受信からレスポンス返却まで
  2. `Business Logic Span`: 各Serviceメソッドの実行時間
  3. `Tool Invocation Span`: AIエージェントの個別ツール実行と引数
  4. `Database Query Span`: SQLクエリ実行時間（クエリパラメータはマスキング）
  5. `External HTTP Span`: 外部API/LLM呼出時間とステータス
