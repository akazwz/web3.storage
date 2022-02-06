
import React, { useEffect, useState } from 'react'
import { RedocStandalone, DropdownLabel  } from 'redoc';

import DocSidebar from '@theme/DocSidebar'
import TOC from '@theme/TOC'
import TOCCollapsible from '@theme/TOCCollapsible'
import useWindowSize from '@theme/hooks/useWindowSize'
import useThemeContext from '@theme/hooks/useThemeContext'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'
import useBaseUrl from '@docusaurus/useBaseUrl'

import { prismThemeToCSS } from './prism'

// These files are generated by scripts/normalize-sidebars.js and scripts/api-toc.js
// The scripts run before every build and before starting the dev server
import sidebarDefinition from './sidebars.json'
import tocDefinition from './toc.json'

const STATIC_SPEC = '/schema.yml'


/**
 * The RedocPage component renders a page for the HTTP API reference using Redoc.
 * To fit the Redoc layout into the rest of the site, it forces Redoc to render
 * the "mobile" layout with responses stacked inline, and it also hides the
 * default Redoc navigation pane. 
 * 
 * To replace the navigation pane, we generate a table of contents definition
 * from the OpenAPI schema and render a TOC component.
 * See /scripts/api-toc.js for the schema -> TOC code.
 * 
 */
function RedocPage() {
  const { isDarkTheme } = useThemeContext()
  const { siteConfig: { themeConfig } } = useDocusaurusContext()
  const prismThemeLight = themeConfig.prism.theme
  const prismThemeDark = themeConfig.prism.darkTheme

  const redocThemeConfig = themeConfig.redoc
  if (!redocThemeConfig) {
    throw new Error('This component expects a "redoc" config object in the site theme config')
  }
  const { lightThemeColors, darkThemeColors, typography } = redocThemeConfig
  const colors = isDarkTheme ? {...lightThemeColors, ...darkThemeColors} : lightThemeColors

  const windowSize = useWindowSize()
  const [tocReady, setTocReady] = useState(false)

  const enableTocHighlights = () => {
    addAnchorClasses()
    setTocReady(true)
  }
  
  useEffect(() => {
    setTimeout(enableTocHighlights, 200)

    // giant hack to override awkward styling of "content type" label in response panel
    monkeyPatchStyledComponent(DropdownLabel, 'position: static;')
  })

  const showDesktopToc = (windowSize === 'desktop' || windowSize === 'ssr')

  const prismOverrides = `
    code {
      background-color: transparent;
    }
  ` + prismThemeToCSS(isDarkTheme ? prismThemeDark : prismThemeLight)

  const extensionHooks = {
    H1: `color: ${colors.headers};`,
    H2: `color: ${colors.headers};`,
    H3: `color: ${colors.headers};`,
    UnderlinedHeader: `
      color: ${colors.headers};
      border-bottom: 1px solid ${colors.headers};

      /* override the text color of dropdown label for e.g. request type */
      .dropdown .dropdown-selector .dropdown-selector-value {
        color: ${colors.text};
      }

      /* override the text color of content type text, e.g. "application/json" */
      && span {
        color: ${colors.text};
      }
    `,
    PropertyNameCell: `background-color: ${colors.background};`,
    PropertyDetailsCell: `background-color: ${colors.background};`,
    Markdown: `
      table tr {
        background-color: ${colors.tableRowBackground};
        &:nth-child(2n) {
          background-color: ${colors.tableRowAltBackground};
        }
      }
    `,
    Prism: prismOverrides,
  }

  const theme = {
    // disable redoc sidebar
    sidebar: {
      width: "0px",
    },

    // force "mobile" stacked layout at all breakpoints
    breakpoints: {
      small: '1rem',
      medium: '100000rem',
      large: '100000rem',
    },

    typography,

    colors: {
      primary: {
        main: colors.primary,
        contrastText: colors.contrastText,
      },
      secondary: {
        main: colors.secondary,
        contrastText: colors.contrastText,
      },
      text: {
        primary: colors.text,
      },
    },

    rightPanel: {
      backgroundColor: colors.responsePanelBackground,
    },

    codeBlock: {
      backgroundColor: colors.codeBlockBackground,
    },
    
    extensionsHook: function (styledName, _props) {
      // console.log('redoc extensions hook', styledName, _props)
      return extensionHooks[styledName]
    }
  }

  const redocOptions = {
    debug: process.env.NODE_ENV !== 'production',
    pathInMiddlePanel: true,
    nativeScrollbars: true,
    disableSearch: true,
    scrollYOffset: 'nav.navbar',

    // FIXME: this is only needed because the hostname is unreadable in dark mode.
    // revert to false if we can figure out how to style the server dropdown.
    hideHostname: true, 
    theme,
  }
  // console.log('redoc options', redocOptions)
  return (
    <div className="docPage_node_modules-@docusaurus-theme-classic-lib-next-theme-DocPage-styles-module">
      <aside className="docSidebarContainer_node_modules-@docusaurus-theme-classic-lib-next-theme-DocPage-styles-module">
        <DocSidebar
          path='/reference/http-api/'
          sidebar={sidebarDefinition.docs} 
        />
      </aside>
      <main className="docMainContainer_node_modules-@docusaurus-theme-classic-lib-next-theme-DocPage-styles-module">
        <div className="container padding-top--md padding-bottom--lg">
          <div className="row">
            <div className="col docItemCol_node_modules-@docusaurus-theme-classic-lib-next-theme-DocItem-styles-module">
              <div className='docItemContainer_node_modules-@docusaurus-theme-classic-lib-next-theme-DocItem-styles-module'>
                <article>
                  <div className='tocCollapsible_node_modules-@docusaurus-theme-classic-lib-next-theme-TOCCollapsible-styles-module theme-doc-toc-mobile tocMobile_node_modules-@docusaurus-theme-classic-lib-next-theme-DocItem-styles-module'>
                    <TOCCollapsible toc={tocDefinition} />
                  </div>
                  <div className='theme-doc-markdown markdown'>
                    <RedocStandalone specUrl={useBaseUrl(STATIC_SPEC)} options={redocOptions} />
                  </div>
                </article>
              </div>
            </div>
            <div className='col col--3'>
              <TOC toc={tocDefinition} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


/**
 * Docusaurus looks for the css selector `.anchor.anchor__h2` when figuring
 * out which TOC anchor is "active" and should be highlighted.
 * 
 * This function finds the section headers generated by Redoc and adds the
 * magic classes, so the TOC component will find them.
 * 
 * Needs to be invoked a few ms after the Redoc component mounts, which is
 * why it's called in a setTimeout above.
 */
 function addAnchorClasses() {
  const selector = 'div[data-section-id]'
  const divs = document.querySelectorAll(selector)
  for (const el of divs) {
    el.classList.add('anchor')
    el.classList.add('anchor__h2')
  }
 }


 /**
  * A hack to add a CSS rule to an existing styled component, for things that don't have
  * extension hooks and can't easily be altered otherwise. Avoid if possible.
  */
 function monkeyPatchStyledComponent(component, styleToAdd) {
  if (!component.componentStyle || !component.componentStyle.rules) {
    return
  }
  if (component.componentStyle.rules.some(r => typeof r === 'string' && r.includes(styleToAdd))) {
    return
  }
  component.componentStyle.rules.push('\n' + styleToAdd + '\n')
 }

export default RedocPage;