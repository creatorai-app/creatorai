"use client"

import Link from "next/link";
import { PolicyPage, PolicySection } from "@/components/legal/PolicyPage";

const sections = [
  { id: "overview", title: "1. Overview & Acceptance" },
  { id: "eligibility", title: "2. Eligibility" },
  { id: "tracking", title: "3. Links, Promo Codes & Attribution" },
  { id: "commission", title: "4. Commission" },
  { id: "promo-code-terms", title: "5. Promo Code Terms" },
  { id: "perks", title: "6. Affiliate Perks" },
  { id: "maturity-refunds", title: "7. Holding Period, Refunds & Chargebacks" },
  { id: "payouts", title: "8. Payouts" },
  { id: "prohibited-promotion", title: "9. Prohibited Promotion" },
  { id: "merchant-of-record", title: "10. Payments & Lemon Squeezy" },
  { id: "privacy", title: "11. Affiliate Data & Privacy" },
  { id: "taxes", title: "12. Taxes & Independent Status" },
  { id: "term-termination", title: "13. Term, Changes & Termination" },
  { id: "contact", title: "14. Contact" },
];

const linkClass =
  "font-medium text-purple-600 hover:text-purple-800 underline underline-offset-4 transition-colors";

const AffiliateTermsPage = () => (
  <PolicyPage
    heading="Affiliate Program Terms"
    sections={sections}
    intro={
      <>
        These terms cover the Creator AI affiliate program: tracking links, promo codes,
        commission, and payouts. They sit alongside our{" "}
        <Link href="/terms" className={linkClass}>
          Terms &amp; Conditions
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className={linkClass}>
          Privacy Policy
        </Link>
        , which continue to apply in full.
      </>
    }
  >
    <PolicySection id="overview" title="1. Overview & Acceptance">
      <p>
        Creator AI runs an affiliate program that pays a recurring commission on
        subscriptions you refer. By generating an affiliate link, accepting an issued promo
        code, or requesting a withdrawal, you agree to these terms.
      </p>
      <p>
        These terms supplement our general Terms &amp; Conditions. Where the two differ on
        an affiliate matter, this document applies.
      </p>
    </PolicySection>

    <PolicySection id="eligibility" title="2. Eligibility">
      <p>
        Any Creator AI account holder can join. Participation is free, and no approval is
        required to create a tracking link. You must be old enough to enter a contract in
        your country and provide accurate payout details.
      </p>
      <p>
        One person or business may hold only one affiliate account. Additional accounts
        created to route commission to yourself may be closed and their balances voided.
      </p>
    </PolicySection>

    <PolicySection id="tracking" title="3. Links, Promo Codes & Attribution">
      <p>
        You can promote Creator AI in two ways: a tracking link
        (<code>trycreatorai.com/?ref=YOURCODE</code>) that you generate yourself, and a promo
        code issued to you by our team, which gives your audience a discount and is shared
        as a code or as a link (<code>trycreatorai.com/?promo=YOURCODE</code>).
      </p>
      <p>
        Both are stored in the visitor&apos;s browser for <strong>30 days</strong> from the
        moment they arrive. If the visitor subscribes within that window, the sale is
        attributed to you automatically. Clearing browser data, switching device or browser,
        or arriving through someone else&apos;s link later can end that attribution.
      </p>
      <p>
        A sale is credited to <strong>one</strong> affiliate. Where a buyer has both a stored
        tracking link and a redeemed promo code, the promo code takes precedence, because it
        is the code that actually discounted the order.
      </p>
    </PolicySection>

    <PolicySection id="commission" title="4. Commission">
      <p>
        The standard rate is <strong>20% of each payment</strong>, for up to{" "}
        <strong>12 payments per referred customer</strong>. Commission is calculated on the
        plan price billed for the cycle — for annual subscriptions, on the full annual
        amount — and continues for as long as the customer stays subscribed, within that
        12-payment cap.
      </p>
      <p>
        Promo codes may carry a different rate, which is shown on the code in your Affiliate
        Hub. We may change the rate on a code at any time; a change applies to sales made
        after it, never retroactively.
      </p>
      <p>
        Commission is not earned on your own purchases, on purchases made by accounts you
        control, or on plans granted manually by our team.
      </p>
    </PolicySection>

    <PolicySection id="promo-code-terms" title="5. Promo Code Terms">
      <p>
        Promo codes are issued at our discretion — they are not automatic on joining. Each
        code is created as a discount in Lemon Squeezy and tied to your account.
      </p>
      <p>
        Unless stated otherwise on the code,{" "}
        <strong>the discount applies to the buyer&apos;s first payment only</strong>. Your
        commission is unaffected by this: you continue earning on that customer&apos;s
        renewals up to the 12-payment cap.
      </p>
      <p>
        We may deactivate, change or delete a promo code at any time — for example when a
        campaign ends or a code is being misused. Deactivating a code removes the discount
        from checkout immediately; commissions already earned on it are unaffected, but no
        new commission accrues while it is inactive.
      </p>
      <p>
        Codes are for your audience. Posting them to coupon aggregators, deal forums or
        extension-based discount finders is not permitted, as this captures buyers who were
        already on their way to purchasing.
      </p>
    </PolicySection>

    <PolicySection id="perks" title="6. Affiliate Perks">
      <p>
        Active affiliates receive <strong>one month of Creator membership free</strong>. The
        month is granted manually by our team after your first referred payment matures —
        contact us from the account holding the sale to claim it.
      </p>
      <p>
        The free month applies to the Creator plan, is limited to one per affiliate account,
        cannot be exchanged for cash or credit, and does not stack with an existing paid
        subscription for the same period.
      </p>
    </PolicySection>

    <PolicySection id="maturity-refunds" title="7. Holding Period, Refunds & Chargebacks">
      <p>
        Every commission is recorded as <strong>pending for 30 days</strong> before it
        matures into your available balance. This window exists because a payment can still
        be refunded or disputed after it clears.
      </p>
      <p>
        If a referred order is refunded or charged back, the related commission is reversed.
        Our payment provider, Lemon Squeezy, may issue a refund within 60 days of an order to
        prevent a dispute, and handles chargebacks on our behalf. Where a reversed commission
        has already been paid out to you, we may deduct it from your next withdrawal.
      </p>
    </PolicySection>

    <PolicySection id="payouts" title="8. Payouts">
      <p>
        Withdrawals are requested from your Affiliate Hub once your available (matured)
        balance reaches <strong>$50</strong>. Payouts are made manually via PayPal, Wise or
        bank transfer to the details you provide, typically within 14 days of a request.
      </p>
      <p>
        You are responsible for the accuracy of those details; we are not liable for funds
        sent to an account you entered incorrectly. Transfer fees charged by your payout
        provider are deducted from the amount you receive.
      </p>
      <p>
        We may hold or refuse a payout while we investigate suspected fraud, self-referral or
        a breach of these terms.
      </p>
    </PolicySection>

    <PolicySection id="prohibited-promotion" title="9. Prohibited Promotion">
      <p>You may not:</p>
      <ul className="list-disc pl-5 space-y-2 marker:text-purple-500">
        <li>Refer yourself, or use your own link or code for your own purchase</li>
        <li>Send unsolicited email, DMs or SMS, or post spam to reach referrals</li>
        <li>Bid on &quot;Creator AI&quot; or our brand terms in paid search, or run ads that imply you are us</li>
        <li>Claim to represent Creator AI, or state pricing, features or guarantees we do not offer</li>
        <li>Use cookie stuffing, forced clicks, redirects, typosquatting or misleading domains</li>
        <li>Post promo codes to coupon aggregators or deal sites</li>
        <li>Promote Creator AI alongside adult, hateful, illegal or infringing content</li>
      </ul>
      <p>
        Breaching this section voids unpaid commission on the affected sales and may end your
        participation in the program.
      </p>
    </PolicySection>

    <PolicySection id="merchant-of-record" title="10. Payments & Lemon Squeezy">
      <p>
        Creator AI subscriptions are sold through{" "}
        <a href="https://www.lemonsqueezy.com" target="_blank" rel="noopener noreferrer" className={linkClass}>
          Lemon Squeezy
        </a>
        , which acts as the <strong>merchant of record</strong>. Lemon Squeezy processes the
        payment, collects any applicable sales tax or VAT, issues the invoice, and handles
        refunds and chargebacks. Buyers therefore contract with Lemon Squeezy for the
        purchase itself, in addition to our Terms for use of the platform.
      </p>
      <p>
        Promo codes you share are Lemon Squeezy discount codes and are subject to their{" "}
        <a href="https://www.lemonsqueezy.com/buyer-terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
          buyer terms
        </a>{" "}
        and{" "}
        <a href="https://www.lemonsqueezy.com/terms" target="_blank" rel="noopener noreferrer" className={linkClass}>
          platform terms
        </a>
        . Neither Creator AI nor you ever handle card details: payment information goes
        directly to Lemon Squeezy and is covered by their{" "}
        <a href="https://www.lemonsqueezy.com/privacy" target="_blank" rel="noopener noreferrer" className={linkClass}>
          privacy policy
        </a>
        .
      </p>
      <p>
        This affiliate program is operated by Creator AI, not by Lemon Squeezy. Commission
        owed to you is our obligation, and payout requests are handled by us.
      </p>
    </PolicySection>

    <PolicySection id="privacy" title="11. Affiliate Data & Privacy">
      <p>
        To run the program we process your account details, the payout details you submit,
        and the record of sales attributed to you. Payout details are used only to pay you.
      </p>
      <p>
        Visitors arriving on your link or promo link have that code stored in their own
        browser for 30 days; it identifies the referring affiliate, not the person. We do not
        sell this data or use it to build advertising profiles.
      </p>
      <p>
        Your Affiliate Hub shows limited information about referred orders so you can verify
        your earnings. Treat anything identifying a customer as confidential: you may not
        contact referred customers on the basis of that data, export it, or use it for any
        purpose other than checking your own commission. Buyer payment data is held by Lemon
        Squeezy and is never exposed to affiliates.
      </p>
      <p>
        Our full{" "}
        <Link href="/privacy" className={linkClass}>
          Privacy Policy
        </Link>{" "}
        explains what we collect, how long we keep it, and how to request access or deletion.
      </p>
    </PolicySection>

    <PolicySection id="taxes" title="12. Taxes & Independent Status">
      <p>
        You participate as an independent party, not as an employee, agent or partner of
        Creator AI, and you have no authority to make commitments on our behalf.
      </p>
      <p>
        Commission is paid gross. You are responsible for declaring and paying any income
        tax, VAT or other charge due on your earnings in your own country. The sales tax
        Lemon Squeezy collects on a subscription is separate and is not part of your
        commission base.
      </p>
    </PolicySection>

    <PolicySection id="term-termination" title="13. Term, Changes & Termination">
      <p>
        You may leave the program at any time by deactivating your links and stopping
        promotion. Matured commission remains payable once it reaches the $50 minimum.
      </p>
      <p>
        We may change these terms, commission rates, the perk in section 6, or the structure
        of the program. Material changes take effect for sales made after they are published
        on this page.
      </p>
      <p>
        We may suspend or end your participation for breach of these terms, fraud, or conduct
        that damages the Creator AI brand. In cases of fraud, unpaid commission is forfeited.
      </p>
    </PolicySection>

    <PolicySection id="contact" title="14. Contact">
      <p>
        Questions about the program, a payout, or a promo code? Email us at{" "}
        <Link href="mailto:support@trycreatorai.com" className={linkClass}>
          support@trycreatorai.com
        </Link>{" "}
        or use our{" "}
        <Link href="/contact-us" className={linkClass}>
          Contact Us
        </Link>{" "}
        page.
      </p>
    </PolicySection>
  </PolicyPage>
);

export default AffiliateTermsPage;
