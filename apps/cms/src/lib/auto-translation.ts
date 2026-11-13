import { AsyncLocalStorage } from "node:async_hooks";
import { errors, setCreatorFields } from "@strapi/utils";
import { translateFields, TranslationConfig } from "./translation-client";
import { applicationTypes } from "./application-pages";

const publicTypes = new Set(["product", "project-case", "article", "certificate", "faq", "site-setting", ...applicationTypes].map(name => `api::${name}.${name}`));

export function registerAutoTranslation(strapi: any) {
  if (!strapi.config?.get?.("auto-translate.enabled", false)) return;
  const synchronizing = new AsyncLocalStorage<boolean>();

  strapi.documents.use(async (context: any, next: () => Promise<any>) => {
    const state = strapi.requestContext.get()?.state;
    if (context.action !== "publish" || !publicTypes.has(context.uid) || synchronizing.getStore() || !state?.user || !state?.userAbility) return next();

    const { uid, contentType, params } = context;
    const localized = Object.entries(contentType.attributes).filter(([, attribute]: [string, any]) => attribute.pluginOptions?.i18n?.localized && !attribute.private);
    if (localized.some(([, attribute]: [string, any]) => !["string", "text", "richtext", "json"].includes(attribute.type))) {
      throw new errors.ValidationError("自动翻译暂不支持此模型的部分本地化字段，请联系开发人员。");
    }
    const fieldNames = localized.map(([name]) => name);
    const uidFields = Object.entries(contentType.attributes).filter(([, attribute]: [string, any]) => attribute.type === "uid").map(([name]) => name);
    const revision = (document: any) => JSON.stringify(document && { updatedAt: document.updatedAt, values: fieldNames.map(name => document[name] ?? null) });
    const locales = strapi.plugin("i18n").service("locales");
    const sourceLocale = params.locale ?? await locales.getDefaultLocale();
    const configured = (await locales.find()).map((locale: any) => locale.code);
    if (typeof sourceLocale !== "string" || !configured.includes(sourceLocale)) {
      throw new errors.ValidationError("自动翻译需要选择一个已配置的源语言后发布。");
    }
    // Retain archived Chinese content and publish configured public site languages.
    const targetLocales = configured.filter((locale: string) => ["en", "ar", "fr"].includes(locale) && locale !== sourceLocale);
    if (!targetLocales.length) throw new errors.ValidationError("请先在国际化设置中添加目标语言，再使用自动翻译发布。");
    const documents = strapi.documents(uid);
    const findDraft = (locale: string) => documents.findOne({ documentId: params.documentId, locale, status: "draft", populate: { createdBy: true, updatedBy: true } });
    const checker = strapi.plugin("content-manager").service("permission-checker").create({ userAbility: state.userAbility, model: uid });
    const requirePermission = (action: string, document: any, fields: string[] = []) => {
      if (!checker.can[action](document) || fields.some(field => !checker.can[action](document, field))) {
        throw new errors.ForbiddenError(`同步发布所需的 ${document.locale} 语言或字段权限不足，请联系管理员。`);
      }
    };

    return synchronizing.run(true, () => strapi.db.transaction(async () => {
      const source = await findDraft(sourceLocale);
      if (!source) return next(); // Preserve the native not-found response.
      requirePermission("read", source, fieldNames);
      requirePermission("publish", source);
      const fields = Object.fromEntries(fieldNames.map(name => [name, source[name] ?? null]));
      const targets = [];
      // Preflight every locale before sending content to the translation service.
      for (const locale of targetLocales) {
        const existing = await findDraft(locale);
        const entity = existing ?? { documentId: params.documentId, locale, createdBy: { id: state.user.id }, updatedBy: { id: state.user.id } };
        // Strapi treats UID fields as localized regardless of schema options;
        // a new locale needs the source UID explicitly, without AI translation.
        const identity = existing ? {} : Object.fromEntries(uidFields.filter(name => source[name] != null).map(name => [name, source[name]]));
        const writeFields = [...fieldNames, ...Object.keys(identity)];
        if (!existing) requirePermission("read", source, Object.keys(identity));
        requirePermission("read", entity, writeFields);
        requirePermission(existing ? "update" : "create", entity, writeFields);
        requirePermission("publish", entity);
        targets.push({ locale, exists: Boolean(existing), identity, original: revision(existing), data: null });
      }
      const config: TranslationConfig = strapi.config.get("auto-translate");
      for (const target of targets) target.data = await translateFields(config, sourceLocale, target.locale, fields);

      if (revision(await findDraft(sourceLocale)) !== revision(source)) {
        throw new errors.ValidationError("源语言内容在翻译期间已被修改，请重新发布。");
      }
      for (const target of targets) {
        if (revision(await findDraft(target.locale)) !== target.original) {
          throw new errors.ValidationError(`${target.locale} 草稿在翻译期间已被修改，请确认内容后重新发布。`);
        }
      }
      // update creates a missing locale on this document and copies shared fields
      // using Strapi's own i18n rules. AI never supplies slug/media/order values.
      for (const target of targets) {
        const data = setCreatorFields({ user: state.user, isEdition: target.exists })({ ...target.data, ...target.identity });
        const updated = await documents.update({ documentId: params.documentId, locale: target.locale, data, populate: { createdBy: true, updatedBy: true } });
        if (!updated) throw new errors.ValidationError("目标语言草稿创建失败，本次同步发布已取消。");
        requirePermission("publish", updated);
      }
      const sourceResult = await next();
      if (!sourceResult?.entries?.length) throw new errors.ValidationError("源语言发布失败，本次同步发布已取消。");
      for (const target of targets) {
        const result = await documents.publish({ documentId: params.documentId, locale: target.locale });
        if (!result?.entries?.length) throw new errors.ValidationError(`${target.locale} 发布失败，本次同步发布已取消。`);
      }
      return sourceResult;
    }));
  });
}
