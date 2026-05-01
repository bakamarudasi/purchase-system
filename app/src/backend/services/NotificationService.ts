/**
 * メール通知サービス
 *
 * 通知パターン:
 * - 新規申請時: 指定された承認者に「承認お願い」メール
 * - 承認/却下時: 申請者に結果メール
 * - 承認済（→確認待ち）: 確認者全員に「確認お願い」メール
 * - 確認済（→購入待ち）: 購入者全員に「購入お願い」メール
 * - 注文済時: 申請者に「注文済」通知メール
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

    /**
     * 確認者リスト全員に確認依頼メール
     */
    static notifyConfirmers(
        application: Application,
        confirmerEmails: string[],
    ): void {
        if (!confirmerEmails || confirmerEmails.length === 0) return;
        try {
            const subject = `[購入申請] 確認をお願いします: 「${application.itemName}」 ${this.formatYen(application.totalPrice)}`;
            const url = this.getAppUrl();
            const body = [
                `購入申請が承認されました。内容のご確認をお願いします。`,
                '',
                `■ 申請者: ${application.name} (${application.department})`,
                `■ 商品名: ${application.itemName}`,
                `■ 数量: ${application.quantity}`,
                `■ 合計: ${this.formatYen(application.totalPrice)}`,
                application.productUrl ? `■ 商品URL: ${application.productUrl}` : '',
                '',
                `■ 購入理由:`,
                application.reason || '(記載なし)',
                '',
                url ? `▼ システムで確認する\n${url}` : '',
            ]
                .filter((line) => line !== '')
                .join('\n');

            // BCC で個別送信（受信者同士のメアドが見えないように）
            MailApp.sendEmail({
                to: confirmerEmails[0],
                bcc: confirmerEmails.slice(1).join(','),
                subject,
                body,
                name: '購入申請システム',
            });
        } catch (e) {
            Logger.log(`確認者メール送信エラー: ${formatError(e)}`);
        }
    }

    /**
     * 購入者リスト全員に購入依頼メール
     */
    static notifyPurchasers(
        application: Application,
        purchaserEmails: string[],
    ): void {
        if (!purchaserEmails || purchaserEmails.length === 0) return;
        try {
            const subject = `[購入申請] 購入をお願いします: 「${application.itemName}」 ${this.formatYen(application.totalPrice)}`;
            const url = this.getAppUrl();
            const body = [
                `購入申請の確認が完了しました。商品の購入をお願いします。`,
                `購入後、システム上で「注文済」ボタンを押し、実際の購入金額を入力してください。`,
                '',
                `■ 申請者: ${application.name} (${application.department})`,
                `■ 商品名: ${application.itemName}`,
                `■ 数量: ${application.quantity}`,
                `■ 単価: ${this.formatYen(application.unitPrice)}`,
                `■ 合計（申請額）: ${this.formatYen(application.totalPrice)}`,
                application.productUrl ? `■ 商品URL: ${application.productUrl}` : '',
                '',
                url ? `▼ システムを開く\n${url}` : '',
            ]
                .filter((line) => line !== '')
                .join('\n');

            MailApp.sendEmail({
                to: purchaserEmails[0],
                bcc: purchaserEmails.slice(1).join(','),
                subject,
                body,
                name: '購入申請システム',
            });
        } catch (e) {
            Logger.log(`購入者メール送信エラー: ${formatError(e)}`);
        }
    }

    /**
     * 注文完了を申請者に通知
     */
    static notifyOrdered(
        application: Application,
        applicantEmail: string,
        purchaserEmail: string,
        actualAmount: number,
        amountDiff: number,
    ): void {
        if (!applicantEmail) return;
        try {
            const subject = `[購入申請] 「${application.itemName}」が注文されました`;
            const url = this.getAppUrl();
            const diffNote =
                amountDiff === 0
                    ? '(申請額と一致)'
                    : amountDiff > 0
                      ? `(申請額より +${this.formatYen(amountDiff)} 高い)`
                      : `(申請額より ${this.formatYen(Math.abs(amountDiff))} 安い)`;
            const body = [
                `${application.name} さま`,
                '',
                `あなたの購入申請が注文されました。`,
                '',
                `■ 商品名: ${application.itemName}`,
                `■ 申請合計: ${this.formatYen(application.totalPrice)}`,
                `■ 実際金額: ${this.formatYen(actualAmount)} ${diffNote}`,
                `■ 購入担当: ${purchaserEmail}`,
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
            Logger.log(`注文済メール送信エラー: ${formatError(e)}`);
        }
    }
}
