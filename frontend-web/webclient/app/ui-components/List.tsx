import styled from "styled-components";
import Box from "./Box";
import * as React from "react";
import {IconName} from "@/ui-components/Icon";
import {Icon} from "@/ui-components/index";
import {ThemeColor} from "./theme";
import {Cursor} from "@/ui-components/Types";
import {EventHandler, MouseEvent, useCallback} from "react";
import {deviceBreakpoint} from "@/ui-components/Hide";

type StringOrNumber = string | number;

interface UseChildPaddingProps {
    childPadding?: StringOrNumber;
}

function useChildPadding(
    props: UseChildPaddingProps
): null | {marginBottom: StringOrNumber; marginTop: StringOrNumber} {
    return props.childPadding ? {marginBottom: props.childPadding, marginTop: props.childPadding} : null;
}

const List = styled(Box) <{fontSize?: string; childPadding?: string | number; bordered?: boolean}>`
    font-size: ${props => props.fontSize};

    & > * {
        ${props => props.bordered ? "border-bottom: 1px solid lightGrey;" : null}
        ${useChildPadding};
    }

    & > *:last-child {
        ${props => props.bordered ? "border-bottom: 0px;" : null}
    }
`;

List.defaultProps = {
    fontSize: "large",
    bordered: true
};

List.displayName = "List";

interface ListRowProps {
    isSelected?: boolean;
    select?: () => void;
    navigate?: () => void;
    truncateWidth?: string;
    left: React.ReactNode;
    leftSub?: React.ReactNode;
    icon?: React.ReactNode;
    right: React.ReactNode;
    fontSize?: string;
    highlight?: boolean;
    stopPropagation?: boolean;
    onContextMenu?: EventHandler<MouseEvent<never>>;
    disableSelection?: boolean;
}

export const ListRow: React.FunctionComponent<ListRowProps> = (props) => {
    const stopPropagation = props.stopPropagation ?? true;
    const doNavigate = useCallback((e: React.SyntheticEvent) => {
        (props.navigate ?? props.select)?.();
        if (stopPropagation) e.stopPropagation();
    }, [props.navigate, props.select, stopPropagation]);

    const doSelect = useCallback((e: React.SyntheticEvent) => {
        if (!props.disableSelection) props.select?.();
        if (stopPropagation) e.stopPropagation();
    }, [props.select, stopPropagation]);

    return <ListStyle
        data-component={"list-row"}
        data-highlighted={props.highlight === true}
        data-selected={props.isSelected === true}
        data-navigate={props.navigate !== undefined}
        onClick={doSelect}
        fontSize={props.fontSize}
        onContextMenu={props.onContextMenu}
    >
        {props.icon ? <div className="row-icon">{props.icon}</div> : null}
        <div className="row-left">
            <div className="row-left-wrapper">
                <div className="row-left-content" onClick={doNavigate}>{props.left}</div>
                <div className="row-left-padding" />
            </div>
            <div className="row-left-sub">{props.leftSub}</div>
        </div>
        <div className="row-right">{props.right}</div>
    </ListStyle>;
}

export const ListStatContainer: React.FunctionComponent = props => <>{props.children}</>;

export const ListRowStat: React.FunctionComponent<{
    icon?: IconName;
    color?: ThemeColor;
    color2?: ThemeColor;
    textColor?: ThemeColor;
    onClick?: () => void;
    cursor?: Cursor;
}> = props => {
    const color: ThemeColor = props.color ?? "gray";
    const color2: ThemeColor = props.color2 ?? "white";
    const body = <>
        {!props.icon ? null : <Icon size={"10"} color={color} color2={color2} name={props.icon} />}
        {props.children}
    </>;

    if (props.onClick) {
        return <a href={"javascript:void(0)"} onClick={props.onClick}>{body}</a>;
    } else {
        return <div>{body}</div>;
    }
};

const ListStyle = styled.div<{fontSize?: string;}>`
    transition: background-color 0.3s;
    padding: 5px 0;
    width: 100%;
    height: 56px;
    align-items: center;
    display: flex;

    &[data-highlighted="true"] {
        background-color: var(--projectHighlight);
    }

    &[data-selected="true"] {
        background-color: var(--lightBlue);
    }

    &:hover {
        background-color: var(--lightBlue);
    }

    .row-icon {
        margin-right: 12px;
        margin-left: 8px;
        flex-shrink: 0;
    }

    .row-left {
        flex-grow: 1;
        overflow: hidden;
        max-width: calc(100vw - 555px);
    }

    &[data-navigate="true"] .row-left-content {
        cursor: pointer;
    }

    .row-left-content {
        margin-bottom: -4px;
        font-size: ${p => p.fontSize ?? "20px"};
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .row-left-content:has(> form) {
        width: 100%;
    }
  
    ${deviceBreakpoint({minWidth: "767px", maxWidth: "1279px"})} {
      .row-left{
        max-width: calc(100vw - 435px);
      }
    }

    ${deviceBreakpoint({maxWidth: "767px"})} {
        .row-left {
            max-width: calc(100vw - 210px);
        }
    }

    .row-left-wrapper {
        display: flex;
    }

    .row-left-padding {
        width: auto;
        cursor: auto;
    }

    .row-left-sub {
        display: flex;
        margin-top: 4px;
    }
    
    .row-left-sub > * {
        margin-right: 16px;
        color: var(--gray);
        text-decoration: none;
        font-size: 10px;
    }
    
    .row-left-sub > * > svg {
        margin-top: -2px;
        margin-right: 4px;
    }

    .row-right {
        text-align: right;
        display: flex;
        margin-right: 8px;
        flex-shrink: 0;
    }
`;

export default List;
