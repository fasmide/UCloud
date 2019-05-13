import * as React from "react";
import { Box, Button, Input, Card, Flex, Text, Image, Error as ErrorMessage } from "ui-components";
import * as Heading from "ui-components/Heading";
import styled from "styled-components";
import { useState, useEffect, useRef } from "react";
import PromiseKeeper from "PromiseKeeper";
import { Cloud } from "Authentication/SDUCloudObject";
import { errorMessageOrDefault } from "UtilityFunctions";
import { History } from "history";
const sduPlainBlack = require("Assets/Images/sdu_plain_black.png");
const bg1 = require("Assets/LoginImages/cloud1.jpg");
const bg2 = require("Assets/LoginImages/cloud2.jpg");
const bg3 = require("Assets/LoginImages/cloud3.jpg");

function randImage() {
    switch ((Math.random() * 3) | 0) {
        case 0:
            return bg1;
        case 1:
            return bg2;
        case 2:
        default:
            return bg3;
    }
}

const BackgroundImage = styled.div<{ image: string}>`
    background: url(${({ image }) => image}) no-repeat center center fixed;
    background-size: cover;
`;

const inDevEnvironment = process.env.NODE_ENV === "development"
const enabledWayf = true;
const wayfService = inDevEnvironment ? "dev-web" : "web";

export const LoginPage = (props: { history: History, initialState?: any }) => {
    if (Cloud.isLoggedIn) {
        props.history.push("/");
        return <div />;
    }

    const [bg] = useState(randImage());
    const [challengeId, setChallengeID] = useState("");
    const verificationInput = useRef<HTMLInputElement>(null);
    const usernameInput = useRef<HTMLInputElement>(null);
    const passwordInput = useRef<HTMLInputElement>(null);
    const [promises] = useState(new PromiseKeeper());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => () => promises.cancelPromises(), []);

    if (props.initialState !== undefined) {
        handleAuthState(props.initialState);
    }

    async function attemptLogin() {
        if (!(usernameInput.current!.value) || !(passwordInput.current!.value)) {
            setError("Invalid username or password");
            return;
        }
        try {
            setLoading(true);
            const body = new FormData();
            body.append("service", wayfService);
            body.append("username", usernameInput.current!.value);
            body.append("password", passwordInput.current!.value);
            const response = await promises.makeCancelable(fetch(`/auth/login?service=${wayfService}`, {
                method: "POST",
                headers: {
                    "Accept": "application/json"
                },
                body
            })).promise;
            if (!response.ok) throw response;
            handleAuthState(await response.json());
        } catch (e) {
            setError(errorMessageOrDefault({ request: e, response: await e.json() }, "An error occurred"))
        } finally {
            setLoading(false);
        }
    }

    async function handleAuthState(result: any) {
        if ("2fa" in result) {
            setChallengeID(result["2fa"]);
        } else {
            Cloud.setTokens(result.accessToken, result.csrfToken);
            props.history.push("/loginSuccess");
        }
    }

    async function submit2FA() {
        const verificationCode = verificationInput.current && verificationInput.current.value || "";
        if (!verificationCode) return;
        try {
            setLoading(true);
            const response = await fetch(`/auth/2fa/challenge`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    challengeId,
                    verificationCode
                })
            });
            if (!response.ok) throw response;
            const result = await response.json();
            Cloud.setTokens(result.accessToken, result.csrfToken);
            props.history.push("/loginSuccess");
        } catch (e) {
            setError(errorMessageOrDefault({ request: e, response: await e.json() }, "Could not submit verification code. Try again later"));
        }
    }
    return (<>
        <BackgroundImage image={bg}>
            <Flex alignItems={"center"} justifyContent={"center"} width={"100vw"} height={"100vh"}>
                <Box>
                    <Flex><Box mr="auto" /><Heading.h2>SDUCloud</Heading.h2><Box ml="auto" /></Flex>
                    <Card bg="lightGray" borderRadius="0.5em" p="1em 1em 1em 1em">
                        <form onSubmit={e => e.preventDefault()}>
                            <Login enabled2fa={!!challengeId} usernameRef={usernameInput} passwordRef={passwordInput} />
                            <TwoFactor enabled2fa={challengeId} inputRef={verificationInput} />
                            <Button fullWidth onClick={() => challengeId ? submit2FA() : attemptLogin()}>
                                {challengeId ? "Submit" : "Login"}
                            </Button>
                        </form>
                        <Box mt="5px"><ErrorMessage error={error} clearError={() => setError("")} /></Box>
                        {enabledWayf && !challengeId ? <a href={`/auth/saml/login?service=${wayfService}`}>
                            <Button fullWidth color="wayfGreen">Login with WAYF</Button>
                        </a> : null}
                    </Card>
                    <Card borderRadius="0.5em" mt="0.3em" height="auto" p="1em 1em 1em 1em" bg="lightBlue">
                        <Flex>
                            <Box><Text fontSize={1} color="textColor">Under construction - Not yet available to the public.</Text></Box>
                        </Flex>
                    </Card>
                    <Flex mt="0.3em"><Box ml="auto" /><Box width="80px" height="21.3667px"><Image width="80px" src={sduPlainBlack} /></Box></Flex>
                </Box>
            </Flex>
        </BackgroundImage>
    </>);
    
}

const TwoFactor = ({ enabled2fa, inputRef }) => enabled2fa ? (
    <Input ref={inputRef} autoComplete="off" autoFocus mb="0.5em" type="text" name="2fa" id="2fa" placeholder="6-digit code" />
) : null;

const Login = ({ enabled2fa, usernameRef, passwordRef }) => !enabled2fa ? (
    <>
        <Input type="hidden" value="web-csrf" name="service" />
        <Input ref={usernameRef} autoFocus mb="0.5em" type="text" name="username" id="username" placeholder="Username" />
        <Input ref={passwordRef} mb="0.8em" type="password" name="password" id="password" placeholder="Password" />
    </>
) : null;

const CenteredBox = styled(Box)`
    margin: 0;
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
`; 