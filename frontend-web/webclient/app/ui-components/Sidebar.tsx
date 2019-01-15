import * as React from "react";
import styled, { css } from "styled-components";
import Text, { EllipsedText } from "./Text";
import Icon, { IconName } from "./Icon";
import Flex from "./Flex";
import Box from "./Box";
import Link from "./Link";
import Divider from "./Divider";
import { Cloud } from "Authentication/SDUCloudObject";
import { fileTablePage } from "Utilities/FileUtilities";
import { ExternalLink, RatingBadge, Hide } from "ui-components";
import { RBox } from "ui-components";
import { ReduxObject, ResponsiveReduxObject } from "DefaultObjects"
import { connect } from 'react-redux'
import { FlexCProps } from "./Flex";


const SidebarElementContainer = styled(Flex)`
    justify-content: left;
    flex-flow: row;
    align-items: center;

    & > ${Text} {
        white-space: nowrap;
    }
`;

//This is applied to SidebarContainer on small screens
const HideText = css`
${({ theme }) => theme.mediaQueryLT["xl"]} {
    
    will-change: transform;
    transition: transform ${({ theme }) => theme.timingFunctions.easeOut} ${({ theme }) => theme.duration.fastest} ${({ theme }) => theme.transitionDelays.xsmall};
    transform: translate(-122px,0); //122 = 190-68 (original - final width)

    & ${Icon},${RatingBadge} {
        will-change: transform;
        transition: transform ${({ theme }) => theme.timingFunctions.easeOut} ${({ theme }) => theme.duration.fastest} ${({ theme }) => theme.transitionDelays.xsmall};
        transform: translate(122px,0); //inverse transformation; same transition function!
    }

    & ${SidebarElementContainer} > ${Text} {
        // transition: opacity ${({ theme }) => theme.timingFunctions.easeOutQuit} ${({ theme }) => theme.duration.fastest} ${({ theme }) => theme.transitionDelays.xsmall};
        transition: opacity ${({ theme }) => theme.timingFunctions.stepStart} ${({ theme }) => theme.duration.fastest} ${({ theme }) => theme.transitionDelays.xsmall};
        opacity: 0;
        will-change: opacity;
    }


    &:hover { 
            transition: transform ${({ theme }) => theme.timingFunctions.easeIn} ${({ theme }) => theme.duration.fastest} ${({ theme }) => theme.transitionDelays.xsmall};
            transform: translate(0,0);

            & ${Icon},${RatingBadge} {
                transition: transform ${({ theme }) => theme.timingFunctions.easeIn} ${({ theme }) => theme.duration.fastest} ${({ theme }) => theme.transitionDelays.xsmall};
                transform: translate(0,0); //inverter transformation
            }

            ${SidebarElementContainer} > ${Text} {
                // transition: opacity ${({ theme }) => theme.timingFunctions.easeInQuint} ${({ theme }) => theme.duration.fastest} ${({ theme }) => theme.transitionDelays.xsmall};
                transition: opacity ${({ theme }) => theme.timingFunctions.stepEnd} ${({ theme }) => theme.duration.fastest} ${({ theme }) => theme.transitionDelays.xsmall};
                opacity: 1;
            }
        
        }
    
}
`;

const SidebarContainer = styled(Flex) <FlexCProps>`
    position: fixed;
    z-index: 80;
    top: 0;
    left: 0;
    padding-top: 48px;
    height: 100%;
    background-color: ${props => props.theme.colors.lightGray}; 
    border-right: 1px solid ${props => props.theme.colors.borderGray};

    ${HideText}
`;

interface TextLabelProps {
    icon: IconName, children: any, height?: string,
    color?: string, color2?: string,
    iconSize?: string, textSize?: number,
    space?: string, hover?: boolean
    title?: string
}

const TextLabel = ({ icon, children, title, height = "30px", color = "iconColor", color2 = "iconColor2",
    iconSize = "24", space = "22px", textSize = 3, hover = true }: TextLabelProps) => (
        <SidebarElementContainer title={title} height={height} ml="22px">
            <Icon name={icon} color={color} color2={color2} size={iconSize} mr={space}
                css={hover ? `${SidebarElementContainer}:hover & { filter: saturate(500%); }` : null}
            />
            <Text fontSize={textSize}> {children} </Text>
        </SidebarElementContainer>
    );

interface SidebarElement { icon: IconName, label: string, to: string, external?: boolean }
const SidebarElement = ({ icon, label, to }: SidebarElement) => (
    <Link to={to}>
        <TextLabel icon={icon}>{label}</TextLabel>
    </Link>
);

const SidebarSpacer = () => (<Box mt="20px" />);

const SidebarPushToBottom = styled.div`
    flex-grow: 1;
`;

type MenuElement = { icon: IconName, label: string, to: string };
type SidebarMenuElements = {
    items: MenuElement[]
    predicate: () => boolean
}

export const sideBarMenuElements: { general: SidebarMenuElements, dev: SidebarMenuElements, auditing: SidebarMenuElements, admin: SidebarMenuElements } = {
    general: {
        items: [
            { icon: "dashboard", label: "Dashboard", to: "/dashboard/" },
            { icon: "files", label: "Files", to: fileTablePage(Cloud.homeFolder) },
            { icon: "share", label: "Shares", to: "/shares/" },
            { icon: "apps", label: "My Apps", to: "/applications/installed/" },
            { icon: "appStore", label: "App Store", to: "/applications/" },
            { icon: "results", label: "My Results", to: "/applications/results/" }
        ], predicate: () => true
    },
    dev: { items: [{ icon: "publish", label: "Publish", to: "/zenodo/publish/" }], predicate: () => process.env.NODE_ENV === "development" },
    auditing: { items: [{ icon: "activity", label: "Activity", to: "/activity/" }], predicate: () => true },
    admin: { items: [{ icon: "admin", label: "Admin", to: "/admin/userCreation/" }], predicate: () => Cloud.userIsAdmin }
};

interface SidebarStateProps {
    responsiveState?: ResponsiveReduxObject
}
interface SidebarProps extends SidebarStateProps {
    sideBarEntries?: any
    responsiveState?: ResponsiveReduxObject
}

const Sidebar = ({ sideBarEntries = sideBarMenuElements, responsiveState }: SidebarProps) => {
    let sidebar = Object.keys(sideBarEntries)
        .map(key => sideBarEntries[key])
        .filter(it => it.predicate())
    return (
        <SidebarContainer color="text" flexDirection="column"
            width={190}
        // css={ responsiveState!.greaterThan.xl ? null : HideText }
        >
            {sidebar.map((category, categoryIdx) =>
                <React.Fragment key={categoryIdx}>
                    {category.items.map(({ icon, label, to }: MenuElement) => (
                        <React.Fragment key={label}>
                            {categoryIdx === 0 ? <SidebarSpacer /> : null}
                            <SidebarElement icon={icon} label={label} to={to} />
                        </React.Fragment>))}
                    {categoryIdx !== sidebar.length - 1 ? (<Divider mt="10px" mb="10px" />) : null}
                </React.Fragment>
            )}
            <SidebarPushToBottom />
            {/* Screen size indicator */}
            {process.env.NODE_ENV === "development" ? <Flex mb={"5px"} width={190} ml={19} justifyContent="left"><RBox /> </Flex> : null}

            <TextLabel height="25px" hover={false} icon="id" iconSize="1em" textSize={1} space=".5em" title={Cloud.username || ""}>
                <EllipsedText width={"140px"}>{Cloud.username}</EllipsedText>
            </TextLabel>

            <ExternalLink href="https://www.sdu.dk/en/om_sdu/om_dette_websted/databeskyttelse">
                <TextLabel height="25px" icon="verified" color2="lightGray" iconSize="1em" textSize={1} space=".5em">
                    SDU Data Protection
                </TextLabel>
            </ExternalLink>
            <Box mb="10px" />

        </SidebarContainer>
    );
};

const mapStateToProps = ({ responsive }: ReduxObject): SidebarStateProps => ({
    responsiveState: responsive
});

export default connect<SidebarStateProps>(mapStateToProps)(Sidebar);
