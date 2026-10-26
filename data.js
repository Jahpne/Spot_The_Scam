/* ==========================================================================
   data.js  |  SPOT THE SCAM
   All the messages, categories and rules live here. To add a card, copy one
   object and edit it. Nothing else needs to change.

   Fields
     type     sms | whatsapp | email | notif | pos | call | story
     from     sender line (sms, whatsapp, email, notif, call)
     sub      email subject
     time     shown time stamp
     body     the message. Wrap clues in [[double brackets]]. They stay
              plain until the player answers, then light up.
     verdict  'scam' or 'real'
     cat      link | secret | promise | alert | imperson | pos | safe
     lvl      difficulty 1 (obvious) to 3 (tricky)
     why      the explanation shown after each answer

   All bank, telecom and shop names are fictional.
   ========================================================================== */
(function (global) {
  'use strict';

  const CATS = {
    link:     { label: 'Suspicious links',            tip: 'Never tap links in texts or emails about money. Open your bank app yourself.' },
    secret:   { label: 'Asking for PIN, OTP or BVN',  tip: 'No bank, ever, needs your PIN, OTP, password or card details from you.' },
    promise:  { label: 'Too-good-to-be-true offers',  tip: 'If you have to pay first to win, earn or borrow, it is a scam.' },
    alert:    { label: 'Fake credit alerts',          tip: 'Only your own banking app confirms money arrived. Screenshots and texts prove nothing.' },
    imperson: { label: 'Impersonation',               tip: 'Hang up and call back on a number you already trust. Verify before you send.' },
    pos:      { label: 'POS and ATM tricks',          tip: 'Type your own PIN, cover the keypad, and check the amount before you confirm.' },
    safe:     { label: 'Genuine messages',            tip: 'Not everything is a scam. Real messages have no links, no threats, and ask for nothing.' },
  };

  const TYPE_LABEL = {
    sms: 'Text message', whatsapp: 'WhatsApp', email: 'Email', notif: 'App notification',
    pos: 'POS receipt', call: 'Phone call', story: 'Situation',
  };

  const LEVELS = [
    { t: 0,    name: 'Easy Target' },
    { t: 800,  name: 'Cautious Customer' },
    { t: 2000, name: 'Sharp Eyes' },
    { t: 4000, name: 'Fraud Spotter' },
    { t: 7000, name: 'Scam Hunter' },
    { t: 11000, name: 'Cyber Guardian' },
    { t: 16000, name: 'Fraud Buster' },
  ];

  const RULES = [
    ['Banks never ask for your PIN, OTP, CVV, password or BVN.', 'Not by call, text, WhatsApp or email. If someone asks, it is a scam.'],
    ['You never pay to receive money.', 'Prizes, loans, jobs and grants that ask for a fee first are scams.'],
    ['Check alerts in your own banking app.', 'A text or a screenshot can be faked. Your app cannot.'],
    ['Do not tap links in messages about money.', 'Open the official app or type the website yourself.'],
    ['Urgency is the trick.', '"Within 1 hour", "or your account is closed". Slow down. Real problems can wait five minutes.'],
    ['Call back on a number you already trust.', 'Use the number on the back of your card, not the one in the message.'],
    ['Only you should type your PIN.', 'At the ATM or POS, no stranger, agent or helper needs to see it or enter it.'],
  ];

  const SCENARIOS = [
    /* ------------------------------ SCAMS ------------------------------ */
    { id: 's01', type: 'sms', from: 'KORA-BANK', time: '09:12', verdict: 'scam', cat: 'link', lvl: 1,
      body: 'Dear customer, your account will be [[blocked within 24 hours]] because your BVN is not updated. Update now: [[kora-bvn-update.co/verify]]',
      why: 'Banks do not block accounts through random links. That web address is not the bank\'s site, and the deadline is there to rush you.' },

    { id: 's02', type: 'whatsapp', from: '+234 810 000 0000', sub: 'Not in your contacts', time: '11:03', verdict: 'scam', cat: 'secret', lvl: 1,
      body: 'Hello, this is Kora Bank customer care. We saw a failed debit of ₦45,000 on your account. Please send the [[6-digit code we just texted you]] so we can reverse it.',
      why: 'That code is your OTP. It lets someone move your money. Real bank staff never ask you for it.' },

    { id: 's03', type: 'sms', from: 'ZIVA-PROMO', time: '14:40', verdict: 'scam', cat: 'promise', lvl: 1,
      body: 'CONGRATULATIONS! Your number has won ₦2,500,000 in the Ziva Mega Draw. To claim, send a [[₦15,000 processing fee]] to 0123456789 (Plume MFB). [[Claim within 2 hours!]]',
      why: 'You cannot win a draw you never entered, and real prizes never ask you to pay first.' },

    { id: 's04', type: 'sms', from: '+234 902 000 0000', time: '16:21', verdict: 'scam', cat: 'alert', lvl: 2,
      body: 'Credit Alert! ₦150,000 was sent to your account by mistake. Please [[return ₦150,000 immediately]] to 0123456789. [[Do not ignore this message.]]',
      why: 'Fake alerts come from a phone number, not your bank. Check your real balance in your banking app. If nothing arrived, there is nothing to return.' },

    { id: 's05', type: 'whatsapp', from: 'Chidi (new customer)', time: '12:55', verdict: 'scam', cat: 'alert', lvl: 2,
      body: 'Boss I have paid ₦80,000. Check your account. See the screenshot: [[Transfer Successful]]. Please send the goods now, I am [[in a hurry]].',
      why: 'A screenshot proves nothing, because anyone can fake one. Only your own bank app or alert confirms the money arrived.' },

    { id: 's06', type: 'email', from: 'Kora Bank Security <support@kora-bank-secure.com>', sub: 'Account suspended: action required', time: '07:48', verdict: 'scam', cat: 'link', lvl: 2,
      body: 'We noticed unusual activity. Your account is [[suspended]]. [[Click here to verify your identity]] within 12 hours or it will be closed permanently.',
      why: 'The sender domain is "kora-bank-secure.com", which is not the bank\'s own domain. Threats and tight deadlines are classic phishing.' },

    { id: 's07', type: 'call', from: 'Unknown number', time: 'Incoming call', verdict: 'scam', cat: 'imperson', lvl: 2,
      body: '"I am from the bank\'s fraud team. Someone is trying to empty your account. For safety, [[move your money to this safe account]] now. [[Stay on the line and do not tell anyone.]]"',
      why: 'There is no "safe account". Real fraud teams never tell you to transfer money or keep a secret. Hang up and call the number on the back of your card.' },

    { id: 's08', type: 'whatsapp', from: 'Remote Jobs NG', sub: 'Broadcast message', time: '10:15', verdict: 'scam', cat: 'promise', lvl: 1,
      body: 'Earn ₦30,000 daily just by liking videos! Limited slots. To start, pay a [[₦5,000 registration fee]]. [[No experience needed, 100% guaranteed.]]',
      why: 'Real employers pay you, not the other way round. "Guaranteed" daily income for easy work is a warning sign.' },

    { id: 's09', type: 'sms', from: 'QUICKCASH', time: '18:02', verdict: 'scam', cat: 'promise', lvl: 2,
      body: 'You are pre-approved for a ₦500,000 loan at [[0% interest]]! Send a [[₦10,000 insurance fee]] first and the money drops in 10 minutes.',
      why: 'Genuine lenders take fees from the loan or charge openly. An upfront "insurance" fee sent to a stranger is a scam pattern.' },

    { id: 's10', type: 'whatsapp', from: '+234 705 000 0000', sub: 'Not in your contacts', time: '20:30', verdict: 'scam', cat: 'imperson', lvl: 2,
      body: 'Hi it is Tunde! I lost my phone, this is my [[new number]]. Please send ₦20,000 [[urgently]], I will pay you back tonight. [[Do not call, my line is bad.]]',
      why: 'Scammers copy a friend\'s name and photo. Call your friend on their old number first. "Do not call" is the giveaway.' },

    { id: 's11', type: 'story', from: 'At the ATM', time: '', verdict: 'scam', cat: 'pos', lvl: 1,
      body: 'Your card is stuck at the ATM. A friendly stranger offers to help and says: "[[Enter your PIN again while I stand close]] and I will press cancel."',
      why: 'He is watching your PIN and may swap your card. Never accept help at an ATM. Press cancel, then call your bank on the number on your card.' },

    { id: 's12', type: 'sms', from: 'KORA-BANK', time: '08:30', verdict: 'scam', cat: 'secret', lvl: 1,
      body: 'Your debit card has been [[restricted]]. Call 0803 000 0000 to reactivate. Have your card number, [[expiry date and PIN]] ready.',
      why: 'A bank never needs your PIN to reactivate a card. That number belongs to a stranger, not the bank.' },

    { id: 's13', type: 'sms', from: 'POWERCO', time: '13:17', verdict: 'scam', cat: 'link', lvl: 2,
      body: 'Your meter has an [[unpaid bill of ₦38,500]]. Pay within 1 hour or face disconnection: [[bit.ly/pw-pay-now]]',
      why: 'Shortened links hide where you are going, and utilities do not threaten one-hour cutoffs by link. Check bills in the official app or at their office.' },

    { id: 's14', type: 'whatsapp', from: 'Forwarded many times', time: '09:44', verdict: 'scam', cat: 'promise', lvl: 1,
      body: 'FREE 50GB data for Ziva\'s anniversary! [[Forward to 10 groups]] then click: [[ziva-free-gb.xyz]]',
      why: 'Chain messages that ask you to forward and click are built to spread scams. Real offers come from the provider\'s own app or number.' },

    { id: 's15', type: 'sms', from: 'BVN-CENTER', time: '15:09', verdict: 'scam', cat: 'secret', lvl: 2,
      body: 'Your BVN is [[due to expire]]. Click [[bvn-renew.info]] or call us to renew and avoid account freeze.',
      why: 'A BVN does not expire. This is a trick to collect your details.' },

    { id: 's16', type: 'sms', from: 'PARCEL-NG', time: '17:26', verdict: 'scam', cat: 'link', lvl: 2,
      body: 'Your parcel is held at customs. Pay a [[₦3,200 clearance fee]] here: [[parcel-track-ng.com]] or it will be returned.',
      why: 'If you are not expecting a parcel, it is not yours. Fees through random links are a trap. Real couriers use their own app.' },

    { id: 's17', type: 'email', from: 'Kora Bank <alerts@korabank-mail.net>', sub: 'New device login', time: '06:55', verdict: 'scam', cat: 'secret', lvl: 2,
      body: 'Someone logged in from a new device. If it was not you, [[reply with your password]] so we can secure the account.',
      why: 'No real security team asks for your password by email. Change it yourself inside the official app.' },

    { id: 's18', type: 'story', from: 'At the POS stand', time: '', verdict: 'scam', cat: 'pos', lvl: 1,
      body: 'The POS agent says the network is bad. He says: "[[Give me your PIN and I will enter it for you]], it is faster."',
      why: 'Only you should type your PIN. Walk away, or enter it yourself while covering the keypad.' },

    { id: 's19', type: 'sms', from: 'SCHOLARSHIP-FUND', time: '19:50', verdict: 'scam', cat: 'secret', lvl: 2,
      body: 'Federal scholarship of ₦500,000 approved for you. Send your [[BVN, card number and PIN]] to receive payment. [[Reply within 1 hour.]]',
      why: 'No grant needs your PIN. Asking for card details and a deadline together is the whole scam.' },

    { id: 's20', type: 'whatsapp', from: 'Wealth Club VIP', sub: 'Broadcast message', time: '21:12', verdict: 'scam', cat: 'promise', lvl: 2,
      body: 'Double your money in 7 days! Invest ₦50,000, get ₦100,000. [[Guaranteed returns, zero risk.]] Join before slots finish.',
      why: 'Nobody can guarantee double returns in a week. These schemes pay early members with new victims\' money until they collapse.' },

    { id: 's21', type: 'story', from: 'At the POS stand', time: '', verdict: 'scam', cat: 'pos', lvl: 3,
      body: 'You asked the POS agent for ₦5,000 cash. The screen says [[NGN 50,000.00]]. He says: "[[It is only a test, it will reverse]]. Just enter your PIN."',
      why: 'Check the amount on the screen before you enter your PIN. "It will reverse" is a stall. Cancel and walk away.' },

    { id: 's22', type: 'sms', from: 'KORA-BANK', time: '10:37', verdict: 'scam', cat: 'link', lvl: 3,
      body: 'A transfer of ₦300,000 to "Obinna E." is pending approval. If this was not you, [[tap kora-secure.net/cancel]] to stop it.',
      why: 'It looks tidy, but the link is not the bank\'s site. If you are worried, open your banking app yourself and check.' },

    { id: 's23', type: 'whatsapp', from: '+234 903 000 0000', sub: 'Not in your contacts', time: '13:41', verdict: 'scam', cat: 'alert', lvl: 3,
      body: 'Good day, I am a POS agent. I sent ₦50,000 to your account by wrong number. Please return it, [[my family needs it for hospital bills]].',
      why: 'Check your real balance first. If the money is not there, it is a scam. If it is, a wrong transfer is fixed through your bank, not a stranger\'s story.' },

    { id: 's24', type: 'call', from: 'Kora Bank (unverified)', time: 'Incoming call', verdict: 'scam', cat: 'secret', lvl: 3,
      body: '"We are upgrading our system. To keep your account active, please [[read me the code]] that will appear on your phone now."',
      why: 'The code that arrives by text is your OTP. It is a key to your money. Never read it out, even to "the bank".' },

    { id: 's25', type: 'email', from: 'Payroll Dept <hr@yourcompany-payroll.co>', sub: 'Salary review: confirm details', time: '08:05', verdict: 'scam', cat: 'imperson', lvl: 3,
      body: 'Your salary increase is ready. Open the [[attached file]] (Salary_Update.zip) and [[enter your bank login]] to confirm.',
      why: 'An unexpected attachment plus "enter your bank login" is credential theft. Check with HR in person or on a number you already have.' },

    /* ------------------------------ REAL ------------------------------ */
    { id: 'r01', type: 'sms', from: 'KORA-BANK', time: '12:08', verdict: 'real', cat: 'safe', lvl: 1,
      body: 'Debit Alert: Acct 2***4567 Amt: NGN 5,000.00 Desc: POS purchase Date: 24-Oct-2026 [[Bal: NGN 42,310.55]]. [[Questions? Call the number on the back of your card.]]',
      why: 'It shows account details and a balance, has no links, and sends you to the number on your card. That is how genuine alerts look.' },

    { id: 'r02', type: 'sms', from: 'KORA-BANK', time: '08:01', verdict: 'real', cat: 'safe', lvl: 1,
      body: 'Your OTP is 482913. It expires in 5 minutes. [[Never share this code with anyone, even bank staff.]]',
      why: 'You asked for this code (for example, you were logging in), and the message warns you not to share it. The danger is giving the code away, not receiving it.' },

    { id: 'r03', type: 'sms', from: 'ZIVA', time: '16:44', verdict: 'real', cat: 'safe', lvl: 2,
      body: 'You have used 90% of your data. [[Open the Ziva app]] to buy more.',
      why: 'No link, no threat, no payment to a stranger. It points you to the official app.' },

    { id: 'r04', type: 'email', from: 'Kora Bank <no-reply@korabank.com>', sub: 'Your October statement is ready', time: '07:00', verdict: 'real', cat: 'safe', lvl: 2,
      body: 'Your statement is ready. [[Log in to the Kora app]] to view it. [[We will never ask for your PIN, password or OTP.]]',
      why: 'It sends you to the app instead of a link, repeats the safety warning, and the sender domain matches the bank.' },

    { id: 'r05', type: 'pos', from: 'Receipt', time: '', verdict: 'real', cat: 'safe', lvl: 2,
      body: 'PLUME FOODS\nTERMINAL ID: 2057XXXX\n[[RRN: 612345678901]]\nCARD: **** 4567\nAMOUNT: NGN 8,400.00\n[[STATUS: APPROVED]]\nCUSTOMER COPY',
      why: 'Terminal ID, reference number, masked card, the amount you agreed, and a clear status. Keep it until your statement matches.' },

    { id: 'r06', type: 'pos', from: 'Receipt', time: '', verdict: 'real', cat: 'safe', lvl: 2,
      body: 'POWERCO PREPAID\nMETER: 0123456789\nAMOUNT: NGN 5,000.00\nUNITS: 71.4 kWh\nTOKEN: 1234-5678-9012-3456\n[[REF: PC-77120934]]\nTHANK YOU',
      why: 'A receipt for something you just bought, with a meter number, units and a reference. It asks you for nothing.' },

    { id: 'r07', type: 'sms', from: 'LAKEVIEW-COLL', time: '11:30', verdict: 'real', cat: 'safe', lvl: 3,
      body: 'Payment of NGN 120,000 for Term 1 fees received. [[Receipt No: LV/2026/0482.]] [[Collect your receipt from the bursar\'s office.]]',
      why: 'It confirms a payment you made, gives a receipt number, and asks you to collect it in person. No link and no new payment.' },

    { id: 'r08', type: 'sms', from: 'SHOPNAIJA', time: '09:20', verdict: 'real', cat: 'safe', lvl: 2,
      body: 'Your order #48213 is out for delivery today. [[Track it in the ShopNaija app.]]',
      why: 'It is about an order you placed, and it points to the app. Nothing to click, nothing to pay.' },

    { id: 'r09', type: 'sms', from: 'KORA-BANK', time: '14:14', verdict: 'real', cat: 'safe', lvl: 3,
      body: 'Card ending 4567 used for NGN 12,000.00 online. If this was not you, [[call the number on the back of your card]] or visit a branch.',
      why: 'It tells you to use the number you already have and asks for nothing. Compare that with scams that hand you a new number or a link.' },

    { id: 'r10', type: 'notif', from: 'Kora App', time: 'now', verdict: 'real', cat: 'safe', lvl: 3,
      body: 'New login on iPhone 13. If this was not you, [[open the Kora app and tap Lock Account]].',
      why: 'It makes you act inside the app you already have. It does not ask for your password or send you to a web link.' },

    { id: 'r11', type: 'story', from: 'You are selling something', time: '', verdict: 'real', cat: 'safe', lvl: 2,
      body: 'A buyer says they paid ₦25,000. Your banking app shows a [[credit of ₦25,000 with their name and a reference number]], and your balance went up by ₦25,000.',
      why: 'The money is confirmed inside your own app. That is the only proof that counts.' },

    { id: 'r12', type: 'whatsapp', from: 'Mum (saved contact)', time: '19:05', verdict: 'real', cat: 'safe', lvl: 1,
      body: 'Call me when you are free. [[Nothing urgent]], I just want to hear your voice.',
      why: 'Saved contact, same chat history, no money request, no pressure. Not every message is a trap.' },

    { id: 'r13', type: 'email', from: 'Plume MFB <alerts@plumemfb.com>', sub: 'Loan repayment reminder', time: '08:30', verdict: 'real', cat: 'safe', lvl: 3,
      body: 'Your repayment of ₦12,500 is due on 30-Oct. It will be taken automatically from your linked account. [[No action needed.]]',
      why: 'It matches a loan you took, asks you for nothing, and includes no link.' },
  ];

  global.SpotData = { SCENARIOS, CATS, TYPE_LABEL, LEVELS, RULES };
})(window);
