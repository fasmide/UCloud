import React from "react";
import {Button} from "react-bootstrap";
import "../../node_modules/loaders.css/loaders.css";

export const PacmanLoading = ({loading}) =>
    !loading ? null :
        (<div className="row loader-primary">
            <div className="loader-demo">
                <div className="loader-inner pacman">
                    <div/>
                    <div/>
                    <div/>
                    <div/>
                    <div/>
                </div>
            </div>
        </div>);

export const BallPulseLoading = (props) =>
    !props.loading ? null :
        (<div className="row loader-primary">
            <div className="loader-demo">
                <div className="loader-inner ball-pulse">
                    <div/>
                    <div/>
                    <div/>
                </div>
            </div>
        </div>);

export const Spinner = (props) => (props.loading) ?
    <i className="loader-inner ball-pulse">
        <div/>
        <div/>
        <div/>
    </i> : null;
export const LoadingButton = (props) => (
    <Button
        bsStyle={props.bsStyle}
        onClick={e => props.handler(e)}
        className={props.style}
        disabled={props.disabled}
    >
        {props.loading ? <Spinner loading/> : props.buttonContent}
    </Button>
);