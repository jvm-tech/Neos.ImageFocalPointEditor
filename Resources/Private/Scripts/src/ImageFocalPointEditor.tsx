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

interface ImageFocalPointEditorProps {
    getNodeByContextPath: (path: string) => TruncatedNode;
    nodeContextPath: string;
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

    updateImageMetadata = (previousImage: any | null) => {
        const {
            getNodeByContextPath,
            nodeContextPath,
        } = this.props;
        let { options: { imageProperty } } = this.props;
        const { loadImageMetadata } = backend.get().endpoints;
        let node = getNodeByContextPath(nodeContextPath);

        if (!node) {
            return;
        }

        if (imageProperty.startsWith('parent:')) {
            imageProperty = imageProperty.replace('parent:', '');
            node = getNodeByContextPath(node.parent)
        }

        if (!node || !node.properties[imageProperty] || !node.properties[imageProperty].__identity) {
            return;
        }
        loadImageMetadata(node.properties[imageProperty].__identity).then((image) => {
            if (previousImage && previousImage.object.__identity === image.object.__identity) {
                return;
            }
            this.setState({ image });
        });
    };

    componentDidMount() {
        this.updateImageMetadata(null);
    }

    componentDidUpdate(prevProps: Readonly<ImageFocalPointEditorProps>, prevState: Readonly<ImageFocalPointEditorState>) {
        this.updateImageMetadata(prevState.image);

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
}))(ImageFocalPointEditor)

