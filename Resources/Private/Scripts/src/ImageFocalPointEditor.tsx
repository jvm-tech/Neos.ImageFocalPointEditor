import React, { CSSProperties, PureComponent } from "react";
import { connect } from 'react-redux';
// @ts-ignore
import { selectors } from "@neos-project/neos-ui-redux-store";
// @ts-ignore
import backend from '@neos-project/neos-ui-backend-connector';
import { Thumbnail } from './Utils';
import '@lemoncode/react-image-focal-point/style.css';
import { FocalPoint, ImageFocalPoint } from "@lemoncode/react-image-focal-point";

// @ts-ignore
import style from './ImageFocalPointEditor.module.css';

type AssetProperty = {
    __identity: string;
};

type TruncatedNode = {
    properties: Record<string, AssetProperty>;
    parent: string;
};

type TransientValue = {
    value: AssetProperty | string | null;
    hooks?: Record<string, any>;
};

const CREATE_IMAGE_VARIANT_HOOK = 'Neos.UI:Hook.BeforeSave.CreateImageVariant';

interface ImageFocalPointEditorProps {
    getNodeByContextPath: (path: string) => TruncatedNode;
    nodeContextPath: string;
    transientValues: Record<string, TransientValue> | undefined;
    commit: (value: string) => void;
    value: string;
    options: {
        imageProperty: string;
    };
}

interface ImageFocalPointEditorState {
    image: any | null;
    pickerRevision: number;
}

class ImageFocalPointEditor extends PureComponent<ImageFocalPointEditorProps, ImageFocalPointEditorState> {
    state = {
        image: null,
        pickerRevision: 0,
    };

    committedValue: string | null = null;

    requestedIdentity: string | null = null;

    isUnmounted = false;

    resolveImageSource = (): { metadata: any } | { identity: string | null } | null => {
        const {
            getNodeByContextPath,
            nodeContextPath,
            transientValues,
        } = this.props;
        let { options: { imageProperty } } = this.props;
        let node = getNodeByContextPath(nodeContextPath);

        if (!node) {
            return null;
        }

        const isParentProperty = imageProperty.startsWith('parent:');
        if (isParentProperty) {
            imageProperty = imageProperty.replace('parent:', '');
            node = getNodeByContextPath(node.parent);
            if (!node) {
                return null;
            }
        }

        const pending = isParentProperty ? undefined : transientValues?.[imageProperty];
        if (pending?.hooks?.[CREATE_IMAGE_VARIANT_HOOK]) {
            return { metadata: pending.hooks[CREATE_IMAGE_VARIANT_HOOK] };
        }

        const value = pending ? pending.value : node.properties[imageProperty];
        const identity = value && typeof value === 'object' ? value.__identity : null;

        return { identity: identity || null };
    };

    updateImageMetadata = () => {
        const source = this.resolveImageSource();
        if (source === null) {
            return;
        }

        if ('metadata' in source) {
            this.requestedIdentity = null;
            if (this.state.image !== source.metadata) {
                this.setState({ image: source.metadata });
            }
            return;
        }

        const { identity } = source;
        if (identity === null) {
            this.requestedIdentity = null;
            if (this.state.image !== null) {
                this.setState({ image: null });
            }
            return;
        }

        if (identity === this.requestedIdentity) {
            return;
        }

        this.requestedIdentity = identity;
        const { loadImageMetadata } = backend.get().endpoints;
        loadImageMetadata(identity).then((image: any) => {
            if (this.isUnmounted || this.requestedIdentity !== identity) {
                return;
            }
            this.setState({ image });
        });
    };

    componentDidMount() {
        this.updateImageMetadata();
    }

    componentWillUnmount() {
        this.isUnmounted = true;
    }

    componentDidUpdate(prevProps: Readonly<ImageFocalPointEditorProps>) {
        this.updateImageMetadata();

        // The picker reads its focal point only on mount. A value that was not set by dragging,
        // e.g. after "Discard" in the inspector, is therefore applied by remounting the picker.
        const { value } = this.props;
        if (value !== prevProps.value && value !== this.committedValue) {
            this.committedValue = value;
            this.setState(({ pickerRevision }) => ({ pickerRevision: pickerRevision + 1 }));
        }
    }

    mapThumbnailStylesToCustomProps(thumbnail: Thumbnail): CSSProperties {
        return thumbnail
            ? {
                  "--crop-area-width": thumbnail.styles.cropArea.width,
                  "--crop-area-height": thumbnail.styles.cropArea.height,
                  "--thumbnail-width": thumbnail.styles.thumbnail.width,
                  "--thumbnail-height": thumbnail.styles.thumbnail.height,
                  "--thumbnail-left": thumbnail.styles.thumbnail.left,
                  "--thumbnail-top": thumbnail.styles.thumbnail.top,
              } as CSSProperties
            : {};
    }
    render() {
        const { commit, value } = this.props;

        const { image, pickerRevision } = this.state;
        if (image === null) {
            return "Select Image";
        }

        const classes = {
            root: style.editorWrapper,
            focalPoint: style.focalPoint,
            image: style.image,
        };
        const thumbnail = image ? Thumbnail.fromImageData(image, 273, 216) : null;
        return (
            <div className={style.wrapper} style={this.mapThumbnailStylesToCustomProps(thumbnail)}>
                {image && (
                    <ImageFocalPoint
                        key={pickerRevision}
                        focalPoint={value ? JSON.parse(value) : undefined}
                        src={this.state.image ? this.state.image.previewImageResourceUri : null}
                        classes={classes}
                        onChange={(focalPoint: FocalPoint) => {
                            this.committedValue = JSON.stringify({
                                x: Math.floor(focalPoint.x),
                                y: Math.floor(focalPoint.y),
                            });
                            commit(this.committedValue);
                        }}
                    />
                )}
            </div>
        );
    }
}

export default connect((state: any) => ({
    nodeContextPath: selectors.CR.Nodes.focusedNodePathSelector(state),
    getNodeByContextPath: selectors.CR.Nodes.nodeByContextPath(state),
    transientValues: selectors.UI.Inspector.transientValues(state),
}))(ImageFocalPointEditor)

