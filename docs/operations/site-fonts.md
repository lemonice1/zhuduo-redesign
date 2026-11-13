# Website fonts

The public website uses the supplied Alibaba PuHuiTi 3.0 font package for
English and French: Regular (400), Medium (500), SemiBold (600), and Bold (700).
The generated subsets also retain Chinese glyphs supported by the original font.
The supplied ZHUDUO logo remains an image with its original lettering.

`apps/web/app/globals.css` defines the shared `--font-site` family. Headings,
body text, form controls, product pages, and inquiry popovers use this family.
`apps/web/app/fonts.css` and `apps/web/public/fonts/alibaba-puhuiti-3/*.woff2`
are generated assets and are included in the repository; production builds
do not need Python or access to the original font package.

Each weight has a Latin/punctuation subset, a subset of characters used by the
website and company catalogue, and additional subsets covering every other
character supported by the original font. The CSS uses disjoint `unicode-range`
declarations so new CMS content can load additional characters on demand.
`font-display: swap` keeps text visible while the webfont loads.

To regenerate from the original directory, install `fonttools[woff]` in a local
Python environment and run from the repository root:

```powershell
python apps/web/scripts/build-fonts.py "PATH_TO_FONT_PACKAGE/AlibabaPuHuiTi-3"
```

The generator preserves the source name records and validates that all original
Unicode characters are present across the generated subsets. Additional CMS
content does not require regeneration. Regenerating after major copy changes
can improve how common characters are grouped for initial loading.

## 阿拉伯语字体

阿拉伯语页面使用本地 Noto Sans Arabic 可变字体（`apps/web/public/fonts/noto-sans-arabic/arabic.woff2`，OFL 许可文件同目录）。英文继续使用 Alibaba PuHuiTi 3.0。阿拉伯语不应用英文字符间距；混排的型号、尺寸与单位使用独立 LTR 文本片段。语言和 CMS 配置见 [网站语言](site-languages.md)。
