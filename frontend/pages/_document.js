import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* Direct Google Translate script inclusion */}
          <script 
            dangerouslySetInnerHTML={{
              __html: `
                function googleTranslateElementInit() {
                  new google.translate.TranslateElement({
                    pageLanguage: 'en',
                    includedLanguages: 'ar,bn,de,en,es,fr,gu,hi,ja,kn,ko,mr,ml,pa,pt,ru,ta,te,zh-CN',
                    layout: google.translate.TranslateElement.InlineLayout.HORIZONTAL,
                    autoDisplay: true
                  }, 'google_translate_element');
                }
              `
            }}
          />
          <script 
            type="text/javascript" 
            src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          />
          
          {/* Minimal styling to avoid hiding the widget */}
          <style>
            {`
              .goog-te-banner-frame {
                display: none !important;
              }
              
              body {
                top: 0 !important;
                position: static !important;
              }
              
              .translate-box {
                position: relative;
                z-index: 1000;
              }
              
              .goog-te-gadget {
                display: inline-block !important;
                font-family: Arial, sans-serif;
                font-size: 15px;
              }
              
              .goog-te-gadget-simple {
                border: 1px solid #ccc !important;
                padding: 8px 12px !important;
                border-radius: 4px !important;
                background-color: white !important;
              }
            `}
          </style>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument; 