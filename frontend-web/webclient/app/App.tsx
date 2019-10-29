import {Cloud} from "Authentication/SDUCloudObject";
import Core from "Core";
import Header from "Navigation/Header";
import {CONTEXT_SWITCH, USER_LOGIN, USER_LOGOUT} from "Navigation/Redux/HeaderReducer";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {Provider} from "react-redux";
import {BrowserRouter} from "react-router-dom";
import {createGlobalStyle, ThemeProvider} from "styled-components";
import {theme, UIGlobalStyle} from "ui-components";
import {invertedColors} from "ui-components/theme";
import {findAvatar} from "UserSettings/Redux/AvataaarActions";
import {store} from "Utilities/ReduxUtilities";
import {isLightThemeStored, setSiteTheme} from "UtilityFunctions";

export function dispatchUserAction(type: typeof USER_LOGIN | typeof USER_LOGOUT | typeof CONTEXT_SWITCH) {
    store.dispatch({type});
}

export async function onLogin() {
    const action = await findAvatar();
    if (action !== null) store.dispatch(action);
}

const GlobalStyle = createGlobalStyle`
  ${() => UIGlobalStyle}
`;

Cloud.initializeStore(store);

function App({children}) {
    const [isLightTheme, setTheme] = React.useState(isLightThemeStored());
    const setAndStoreTheme = (isLight: boolean) => (setSiteTheme(isLight), setTheme(isLight));

    function toggle() {
        setAndStoreTheme(!isLightTheme);
    }

    return (
        <ThemeProvider theme={isLightTheme ? theme : {...theme, colors: invertedColors}}>
            <>
                <GlobalStyle />
                <BrowserRouter basename="app">
                    <Header toggleTheme={toggle} />
                    {children}
                </BrowserRouter>
            </>
        </ThemeProvider>
    );
}

ReactDOM.render(
    (
        <Provider store={store}>
            <App>
                <Core />
            </App>
        </Provider>
    ),
    document.getElementById("app")
);
