# SRE・CI/CD レビュー観点チェックリスト (sre-cicd-checklist.md)

本チェックリストは、CI/CDパイプライン、リリースマネジメント、運用品質の検証観点を定義します。

## 1. CI/CDパイプライン ＆ リリースマネジメント（今回の再発防止観点）
- [ ] **マージ後CDワークフロー監視の完了（DoD必須条件）**:
  - `main` マージ後、GitHub Actions の CD パイプライン（`deploy.yml`）が完全 SUCCESS で終了したことを必ず確認したか。
  - Git タグおよび GitHub Release が自動作成されたか（`vX.Y.Z`）。
  - S3 への静的ファイル配置と CloudFront キャッシュ無効化が正常に完了したか。
- [ ] **クリーンインストール整合性**:
  - `npm ci --dry-run` または `npm run test:ci` が成功し、クリーン環境での peer-dependency 不整合（`ERESOLVE`）が排除されているか。
- [ ] **自動バージョニング検証**:
  - `main` マージごとの自動インクリメント（パッチ自動採番）が正常に機能しているか。
  - 静的ビルドステップに `NEXT_PUBLIC_APP_VERSION` が確実に伝搬しているか。

## 2. インフラ・セキュリティ
- [ ] **AWS OIDC認証**:
  - 静的アクセスキーを使用せず、IAMロール（AssumeRoleWithWebIdentity）経由で安全に認証しているか。
- [ ] **FinOps Guard**:
  - 静的バンドルサイズ（`out/`）が無料枠許容サイズ（50MB）を超過していないか。
