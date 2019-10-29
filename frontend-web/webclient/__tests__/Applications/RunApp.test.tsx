import {createMemoryHistory} from "history";
import "jest-styled-components";
import * as React from "react";
import {Provider} from "react-redux";
import {MemoryRouter} from "react-router";
import {create} from "react-test-renderer";
import {ThemeProvider} from "styled-components";
import RunApp from "../../app/Applications/Run";
import theme from "../../app/ui-components/theme";
import {store} from "../../app/Utilities/ReduxUtilities";

describe("RunApp component", () => {
    test("Mount", () => {
        expect(create(
            <Provider store={store}>
                <ThemeProvider theme={theme}>
                    <MemoryRouter>
                        <RunApp
                            match={{
                                params: {appName: "appName", appVersion: "appVersion"},
                                isExact: true,
                                path: "",
                                url: "",
                            }}
                            history={createMemoryHistory()}
                        />
                    </MemoryRouter>
                </ThemeProvider>
            </Provider>
        ).toJSON()
        ).toMatchSnapshot();
    });

});
