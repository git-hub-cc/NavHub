# Pure Front-End Static Navigation Page

This is a lightweight, elegant, and powerful pure front-end personal navigation/start page. It's built with basic HTML, CSS, and Vanilla JavaScript, requiring no complex build tools or backend services. Simply upload the files to any static hosting platform (like GitHub Pages, Vercel, Netlify, or your own server) to have your own highly customizable homepage.

[中文版](./README-cn.md)

## ✨ Features

*   **Purely Static, Zero Dependencies**: No Node.js, no database, no build process. Deployment is simple.
*   **Responsive Design**: Perfectly adapts to desktop and mobile devices, with the sidebar automatically switching to a bottom navigation bar on mobile.
*   **Light/Dark Mode**: Supports manual switching, automatically adapts to OS preference, and remembers the user's choice.
*   **Multiple Data Sources**: Pre-packaged with site data from various well-known content creators. Easily switch between them from the sidebar, which will overwrite your local configuration.
*   **Enhanced Aggregated Search**:
    *   Customizable search categories (e.g., Web, Video, Programming, Shopping).
    *   Select multiple search engines within the same category.
    *   One search query opens results from all selected engines in new tabs simultaneously.
    *   Includes search suggestions (powered by Baidu suggestion API).
*   **Customizable Site Management**:
    *   Easily **add** and **edit** websites in the "My Navigation" category through a graphical modal.
    *   Supports **drag-and-drop sorting** to freely arrange the order of sites in "My Navigation".
*   **Local Data Persistence**: All user-customized sites, their order, and theme preferences are saved locally in the browser via `localStorage`, so no reconfiguration is needed on the next visit.
*   **JSON File Configuration**:
    *   Initial navigation sites are configured via `sites.json`.
    *   Search engines are configured via `engines.json`, making them highly extensible.

## 🚀 Quick Start

Setting up your own navigation page with this template is very simple.

### 1. Get the Code

Clone or download this project to your local machine.

### 2. Customize Initial Sites (Optional)

Open the `sites.json` file. You can modify, add, or delete the categories and sites within it. This serves as the default data for the navigation page on its first load.

Each site object contains the following fields:
*   `title`: The title of the website.
*   `url`: The link to the website.
*   `icon`: The URL of the website's icon.
*   `desc`: A description of the website.
*   `proxy` (boolean): Indicates if proxy access is needed, which displays a badge on the card's top right.

### 3. Customize Search Engines (Optional)

Open the `engines.json` file. Here you can modify the aggregated search feature.
*   `categories`: Defines the search category buttons.
*   `engines`: Defines the available search engines for each category. `%s` is the placeholder for the search query.

### 4. Personalize in Your Browser

Simply open `index.html` in your browser to start using it.
*   **Add a Site**: Click the "Add" (新增) button on the right of the "My Navigation" (我的导航) category.
*   **Edit/Delete a Site**: Click the "Edit" (编辑) button to enter edit mode. Then, click any site card to edit or delete it.
*   **Sort Sites**: In edit mode, simply drag and drop the site cards within the "My Navigation" category to reorder them.
*   **Finish Editing**: Click the "Done" (完成) button to exit edit mode.
*   **Switch Data Source**: In the "Data Source" dropdown at the bottom of the sidebar, select the site data you want to use. Note: Switching the data source will clear and overwrite all your custom sites and their order in the "My Navigation" category.

### 5. Deploy

Upload the entire project folder (including all `.html`, `.css`, `.js`, and `.json` files) to any web server or hosting platform that supports static files.

*   **GitHub Pages**: Push the code to your GitHub repository and enable the Pages feature in the repository settings.
*   **Vercel/Netlify**: Link your GitHub repository directly, and the platform will handle the deployment automatically.
*   **Cloud Server**: Use a web server like Nginx or Apache and point the root directory to the project folder.


## 🔧 Dependencies and Acknowledgements

*   This project is implemented in pure native JavaScript, with no external framework dependencies.
*   The search suggestion feature is implemented by dynamically loading data from the [Baidu Suggestion API](https://www.baidu.com/s?wd=).
*   The interface design is from[onenav](https://github.com/helloxz/onenav).
*   The raw Pinyin data is sourced from [pinyin-data](https://github.com/mozillazg/pinyin-data).
*   Thanks to **哆啦A梦的神奇口袋** for their organization and sharing!
*   Thanks to **小帅同学** for their organization and sharing!
*   Thanks to **懒人找资源** for their organization and sharing!
*   Thanks to **薛信的资料室** for their organization and sharing!
*   Thanks to **资源公社&语雀分享** for their organization and sharing!
*   Thanks to **资源汇社区资源库** for their organization and sharing!
*   Thanks to **金榜题名** for their organization and sharing!
*   Thanks to **阿虚同学** for their organization and sharing!
*   Thanks to **阿虚软件库** for their organization and sharing!
*   Thanks to **陈蛋蛋的宝藏库** for their organization and sharing!
*   Thanks to **鱼果天晴的资源库** for their organization and sharing