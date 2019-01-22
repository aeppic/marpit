import MarkdownIt from 'markdown-it'
import wrapArray from './helpers/wrap_array'
import ThemeSet from './theme_set'
import { marpitContainer } from './element'
import marpitApplyDirectives from './markdown/directives/apply'
import marpitBackgroundImage from './markdown/background_image'
import marpitCollect from './markdown/collect'
import marpitComment from './markdown/comment'
import marpitContainerPlugin from './markdown/container'
import marpitHeaderAndFooter from './markdown/header_and_footer'
import marpitHeadingDivider from './markdown/heading_divider'
import marpitInlineSVG from './markdown/inline_svg'
import marpitParseDirectives from './markdown/directives/parse'
import marpitParseImage from './markdown/parse_image'
import marpitSlide from './markdown/slide'
import marpitSlideContainer from './markdown/slide_container'
import marpitStyleAssign from './markdown/style/assign'
import marpitStyleParse from './markdown/style/parse'
import marpitSweep from './markdown/sweep'
import marpitVideo from './markdown/video'

const defaultOptions = {
  backgroundSyntax: true,
  container: marpitContainer,
  filters: true,
  headingDivider: false,
  inlineStyle: true,
  looseYAML: false,
  markdown: 'commonmark',
  printable: true,
  scopedStyle: true,
  slideContainer: false,
  inlineSVG: false,
  video: false,
}

/**
 * Parse Marpit Markdown and render to the slide HTML/CSS.
 */
class Marpit {
  /**
   * Create a Marpit instance.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.backgroundSyntax=true] Support markdown image syntax
   *     with the alternate text including `bg`. Normally it converts into spot
   *     directives about background image. If `inlineSVG` is enabled, it
   *     supports the advanced backgrounds.
   * @param {false|Element|Element[]}
   *     [opts.container={@link module:element.marpitContainer}] Container
   *     element(s) wrapping whole slide deck.
   * @param {boolean} [opts.filters=true] Support filter syntax for markdown
   *     image. It can apply to inline image and the advanced backgrounds.
   * @param {false|number|number[]} [opts.headingDivider=false] Start a new
   *     slide page at before of headings. it would apply to headings whose
   *     larger than or equal to the specified level if a number is given, or
   *     ONLY specified levels if a number array.
   * @param {boolean} [opts.inlineStyle=true] Recognize `<style>` elements to
   *     append additional styles to theme. When it is `true`, Marpit will parse
   *     style regardless markdown-it's `html` option.
   * @param {boolean} [opts.looseYAML=false] Allow loose YAML for directives.
   * @param {string|Object|Array} [opts.markdown='commonmark'] markdown-it
   *     initialize option(s).
   * @param {boolean} [opts.printable=true] Make style printable to PDF.
   * @param {boolean} [opts.scopedStyle=true] Support scoping inline style to
   *     the current slide through `<style scoped>` when `inlineStyle` is
   *     enabled.
   * @param {false|Element|Element[]} [opts.slideContainer] Container element(s)
   *     wrapping each slide sections.
   * @param {boolean} [opts.inlineSVG=false] Wrap each sections by inline SVG.
   *     _(Experimental)_
   * @param {boolean} [opts.video=false] Support video element by image syntax.
   *     _(Experimental)_
   */
  constructor(opts = {}) {
    /**
     * The current options for this instance.
     *
     * This property is read-only and marked as immutable. You cannot change the
     * value of options after creating instance.
     *
     * @member {Object} options
     * @memberOf Marpit#
     * @readonly
     */
    Object.defineProperty(this, 'options', {
      enumerable: true,
      value: Object.freeze({ ...defaultOptions, ...opts }),
    })

    Object.defineProperties(this, {
      containers: { value: [...wrapArray(this.options.container)] },
      slideContainers: { value: [...wrapArray(this.options.slideContainer)] },
    })

    /**
     * @type {ThemeSet}
     */
    this.themeSet = new ThemeSet()

    /**
     * @type {MarkdownIt}
     */
    this.markdown = new MarkdownIt(...wrapArray(this.options.markdown))
    this.applyMarkdownItPlugins()
  }

  /**
   * The plugin interface of markdown-it for current Marpit instance.
   *
   * This is useful to integrate Marpit with the other markdown-it based parser.
   *
   * @type {Function}
   * @readonly
   */
  get markdownItPlugins() {
    return this.applyMarkdownItPlugins.bind(this)
  }

  /** @private */
  applyMarkdownItPlugins(md = this.markdown) {
    const {
      backgroundSyntax,
      filters,
      looseYAML,
      scopedStyle,
      video,
    } = this.options

    md.use(marpitComment, { looseYAML })
      .use(marpitStyleParse, this)
      .use(marpitSlide)
      .use(marpitParseDirectives, this, { looseYAML })
      .use(marpitApplyDirectives)
      .use(marpitHeaderAndFooter)
      .use(marpitHeadingDivider, this)
      .use(marpitSlideContainer, this.slideContainers)
      .use(marpitContainerPlugin, this.containers)
      .use(marpitParseImage, { filters })
      .use(marpitSweep)
      .use(marpitInlineSVG, this)
      .use(marpitStyleAssign, this, { supportScoped: scopedStyle })
      .use(marpitCollect, this)

    if (backgroundSyntax) md.use(marpitBackgroundImage)
    if (video) md.use(marpitVideo)
  }

  /**
   * @typedef {Object} Marpit~RenderResult
   * @property {string|string[]} html Rendered HTML.
   * @property {string} css Rendered CSS.
   * @property {string[][]} comments Parsed HTML comments per slide pages,
   *     excepted YAML for directives. It would be useful for presenter notes.
   */

  /**
   * Render Markdown into HTML and CSS string.
   *
   * @param {string} markdown A Markdown string.
   * @param {Object} [env] Environment object for passing to markdown-it.
   * @param {boolean} [env.htmlAsArray=false] Output rendered HTML as array per
   *     slide.
   * @returns {Marpit~RenderResult} An object of rendering result.
   */
  render(markdown, env = {}) {
    return {
      html: this.renderMarkdown(markdown, env),
      css: this.renderStyle(this.lastGlobalDirectives.theme),
      comments: this.lastComments,
    }
  }

  /**
   * Render Markdown by using `markdownIt#render`.
   *
   * This method is for internal. You can override this method if you have to
   * render with customized way.
   *
   * @private
   * @param {string} markdown A Markdown string.
   * @param {Object} [env] Environment object for passing to markdown-it.
   * @param {boolean} [env.htmlAsArray=false] Output rendered HTML as array per
   *     slide.
   * @returns {string|string[]} The result string(s) of rendering Markdown.
   */
  renderMarkdown(markdown, env = {}) {
    if (env.htmlAsArray) {
      this.markdown.parse(markdown, env)

      return this.lastSlideTokens.map(slide =>
        this.markdown.renderer.render(slide, this.markdown.options, env)
      )
    }

    return this.markdown.render(markdown, env)
  }

  /**
   * Render style by using `themeSet#pack`.
   *
   * This method is for internal.
   *
   * @private
   * @param {string|undefined} theme Theme name.
   * @returns {string} The result string of rendering style.
   */
  renderStyle(theme) {
    return this.themeSet.pack(theme, this.themeSetPackOptions())
  }

  /** @private */
  themeSetPackOptions() {
    return {
      after: this.lastStyles ? this.lastStyles.join('\n') : undefined,
      containers: [...this.containers, ...this.slideContainers],
      inlineSVG: this.options.inlineSVG,
      printable: this.options.printable,
    }
  }

  /**
   * Load the specified markdown-it plugin with given parameters.
   *
   * @param {Function} plugin markdown-it plugin.
   * @param {...*} params Params to pass into plugin.
   * @returns {Marpit} The called {@link Marpit} instance for chainable.
   */
  use(plugin, ...params) {
    plugin.call(this.markdown, this.markdown, ...params)
    return this
  }
}

export default Marpit
