/**
 * メール通知サービス
 * - 新規申請時: 指定された承認者に「承認お願い」メール
 * - 承認/却下時: 申請者に結果メール
 *
 * GAS の MailApp は 1 日 100 通までの制限あり（社内向けには十分）。
 * 通知はあくまで補助なので、送信失敗してもメイン処理は止めない。
 */

import { Application } from '../models/Application';
import { formatError } from '../utils/format';

export class NotificationService {
    /**
     * Web App の URL を取得（メール本文中のリンク用）
     * デプロイ前 or 取得失敗時は空文字
     */
    private static getAppUrl(): string {
        try {
            return ScriptApp.getService().getUrl() || '';
        } catch (e) {
            Logger.log(`Web App URL 取得エラー: ${formatError(e)}`);
            return '';
        }
    }

    private static formatYen(amount: number): string {
        return `¥${amount.toLocaleString('ja-JP')}`;
    }

    /**
     * 新規申請が登録されたことを承認者に通知
     */
    static notifyNewApplication(
        application: Application,
        approverEmail: string,
    ): void {
        if (!approverEmail) return;
        try {
            const subject = `[購入申請] ${application.name} から「${application.itemName}」 ${this.formatYen(application.totalPrice)}`;
            const url = this.getAppUrl();
            const body = [
                `${approverEmail} さま`,
                '',
                `下記の購入申請が登録されました。承認をお願いします。`,
                '',
                `■ 申請者: ${application.name} (${application.department})`,
                `■ 商品名: ${application.itemName}`,
                `■ 数量: ${application.quantity}`,
                `■ 単価: ${this.formatYen(application.unitPrice)}`,
                `■ 合計: ${this.formatYen(application.totalPrice)}`,
                application.productUrl ? `■ 商品URL: ${application.productUrl}` : '',
                '',
                `■ 購入理由:`,
                application.reason || '(記載なし)',
                '',
                url ? `▼ 申請を確認する\n${url}` : '',
            ]
                .filter((line) => line !== '')
                .join('\n');

            MailApp.sendEmail({
                to: approverEmail,
                subject,
                body,
                name: '購入申請システム',
            });
        } catch (e) {
            Logger.log(`新規申請メール送信エラー: ${formatError(e)}`);
        }
    }

    /**
     * 承認/却下の結果を申請者に通知
     */
    static notifyDecision(
        application: Application,
        applicantEmail: string,
        decision: '承認' | '却下',
        approverEmail: string,
        comment: string,
    ): void {
        if (!applicantEmail) return;
        try {
            const verbSubject = decision === '承認' ? '承認されました' : '却下されました';
            const subject = `[購入申請] 「${application.itemName}」が${verbSubject}`;
            const url = this.getAppUrl();
            const body = [
                `${application.name} さま`,
                '',
                `あなたの購入申請が ${decision} されました。`,
                '',
                `■ 商品名: ${application.itemName}`,
                `■ 合計: ${this.formatYen(application.totalPrice)}`,
                `■ 結果: ${decision}`,
                `■ 承認者: ${approverEmail}`,
                comment ? `■ コメント:\n${comment}` : '',
                '',
                url ? `▼ 詳細を確認する\n${url}` : '',
            ]
                .filter((line) => line !== '')
                .join('\n');

            MailApp.sendEmail({
                to: applicantEmail,
                subject,
                body,
                name: '購入申請システム',
            });
        } catch (e) {
            Logger.log(`結果メール送信エラー: ${formatError(e)}`);
        }
    }
}
