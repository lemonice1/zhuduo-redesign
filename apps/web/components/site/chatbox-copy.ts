const en = {
  title: "Chat with Us", close: "Minimize chat", send: "Send message", placeholder: "Write your message…",
  greeting: "Hello! Tell us what you need. Leave your email or WhatsApp and our team will get back to you.",
  details: "Thanks for your message. Please leave your contact details so we can reply.",
  contactTitle: "How can we reach you?", name: "Name", country: "Country or region", email: "Email", whatsapp: "WhatsApp",
  contactHint: "Enter an email or WhatsApp number with country code.", submit: "Send contact details", sending: "Sending…",
  success: "Thank you! Your message and contact details have been received. Our team will contact you soon.",
  preview: "Preview only. Nothing is sent or saved.", previewSuccess: "Preview complete. No information was sent or saved.",
  again: "Start a new inquiry", checkField: "Please check this field.", contactError: "Enter a valid email or international WhatsApp number.",
  tooLong: "Please keep the conversation within 4,000 characters.", unavailable: "Unable to save your message. Please try again.",
  unconfirmed: "Saving was not confirmed. Please contact us before resubmitting.", limited: "Too many requests. Please try again later.",
  verification: "Please complete verification before sending.", verificationError: "Verification is unavailable. Please try again.",
  messageLabel: "Your message", messages: "Conversation", contactSummary: "Contact details", emailPlaceholder: "you@company.com"
};

type Copy = { [Key in keyof typeof en]: string };

const fr: Copy = {
  title: "Discutons ensemble", close: "Réduire la discussion", send: "Envoyer le message", placeholder: "Écrivez votre message…",
  greeting: "Bonjour ! Parlez-nous de vos besoins. Laissez votre e-mail ou votre numéro WhatsApp et notre équipe vous recontactera.",
  details: "Merci pour votre message. Laissez vos coordonnées pour que nous puissions vous répondre.",
  contactTitle: "Comment vous contacter ?", name: "Nom", country: "Pays ou région", email: "E-mail", whatsapp: "WhatsApp",
  contactHint: "Indiquez un e-mail ou un numéro WhatsApp avec l’indicatif du pays.", submit: "Envoyer mes coordonnées", sending: "Envoi…",
  success: "Merci ! Votre message et vos coordonnées ont bien été reçus. Notre équipe vous contactera prochainement.",
  preview: "Aperçu uniquement. Rien n’est envoyé ni enregistré.", previewSuccess: "Aperçu terminé. Aucune information n’a été envoyée ni enregistrée.",
  again: "Nouvelle demande", checkField: "Veuillez vérifier ce champ.", contactError: "Indiquez un e-mail valide ou un numéro WhatsApp international.",
  tooLong: "La conversation doit contenir au maximum 4 000 caractères.", unavailable: "Impossible d’enregistrer votre message. Veuillez réessayer.",
  unconfirmed: "L’enregistrement n’a pas été confirmé. Contactez-nous avant de renvoyer votre demande.", limited: "Trop de demandes. Veuillez réessayer plus tard.",
  verification: "Veuillez terminer la vérification avant l’envoi.", verificationError: "La vérification est indisponible. Veuillez réessayer.",
  messageLabel: "Votre message", messages: "Conversation", contactSummary: "Coordonnées", emailPlaceholder: "vous@entreprise.com"
};

const ar: Copy = {
  title: "تحدث معنا", close: "تصغير المحادثة", send: "إرسال الرسالة", placeholder: "اكتب رسالتك…",
  greeting: "مرحباً! أخبرنا باحتياجاتك واترك بريدك الإلكتروني أو رقم واتساب، وسيتواصل معك فريقنا.",
  details: "شكراً لرسالتك. يرجى ترك معلومات الاتصال حتى نتمكن من الرد عليك.",
  contactTitle: "كيف يمكننا التواصل معك؟", name: "الاسم", country: "الدولة أو المنطقة", email: "البريد الإلكتروني", whatsapp: "واتساب",
  contactHint: "أدخل بريداً إلكترونياً أو رقم واتساب مع رمز الدولة.", submit: "إرسال معلومات الاتصال", sending: "جارٍ الإرسال…",
  success: "شكراً لك! تم استلام رسالتك ومعلومات الاتصال. سيتواصل معك فريقنا قريباً.",
  preview: "معاينة فقط. لا يتم إرسال أي معلومات أو حفظها.", previewSuccess: "اكتملت المعاينة. لم يتم إرسال أي معلومات أو حفظها.",
  again: "بدء استفسار جديد", checkField: "يرجى التحقق من هذا الحقل.", contactError: "أدخل بريداً إلكترونياً صالحاً أو رقم واتساب دولياً.",
  tooLong: "يجب ألا تتجاوز المحادثة ٤٠٠٠ حرف.", unavailable: "تعذر حفظ رسالتك. يرجى المحاولة مجدداً.",
  unconfirmed: "لم يتم تأكيد الحفظ. يرجى التواصل معنا قبل إعادة الإرسال.", limited: "طلبات كثيرة جداً. يرجى المحاولة لاحقاً.",
  verification: "يرجى إكمال التحقق قبل الإرسال.", verificationError: "التحقق غير متاح حالياً. يرجى المحاولة مجدداً.",
  messageLabel: "رسالتك", messages: "المحادثة", contactSummary: "معلومات الاتصال", emailPlaceholder: "you@company.com"
};

export const chatboxCopy = { en, fr, ar };
