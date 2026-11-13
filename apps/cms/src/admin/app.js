import { businessProductLayout, businessCategoryLayout } from "./product-editor-data.mjs";
import { ProductCategoryInput, ProductDetailInput, ProductRowsInput, ProductTitleInput, CategoryLocationInput } from "./product-editor";
import { businessProjectLayout } from "./project-editor-data.mjs";
import { ProjectRowsInput } from "./project-editor";

export default {
  config: {
    locales: ["zh-Hans"]
  },
  register(app) {
    app.addFields([
      { type: "project-rows", Component: ProjectRowsInput },
      { type: "category-location", Component: CategoryLocationInput },
      { type: "product-title", Component: ProductTitleInput },
      { type: "product-category", Component: ProductCategoryInput },
      { type: "product-detail", Component: ProductDetailInput },
      { type: "product-options", Component: ProductRowsInput },
      { type: "product-faqs", Component: ProductRowsInput }
    ]);
    app.registerHook("Admin/CM/pages/EditView/mutate-edit-view-layout", businessProductLayout);
    app.registerHook("Admin/CM/pages/EditView/mutate-edit-view-layout", businessCategoryLayout);
    app.registerHook("Admin/CM/pages/EditView/mutate-edit-view-layout", businessProjectLayout);
  },
  bootstrap() {
    // Strapi reads this preference when rendering; account preferences take precedence after login.
    const languageKey = "strapi-admin-language";
    if (!window.localStorage.getItem(languageKey)) {
      window.localStorage.setItem(languageKey, "zh-Hans");
    }
  }
};
