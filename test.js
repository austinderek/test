import React from "react";
import PropTypes from "prop-types";
import _ from "lodash";
import styles from "./styles.css";
import FileTree from "../FileTree";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCopy,
  faCog,
  faChevronRight,
  faChevronLeft,
  faBoxOpen
} from "@fortawesome/free-solid-svg-icons";

const DisplayTypeOnePage = "one_page";
const DisplayTypeOnePageTree = "one_page_tree";
const DisplayTypeFileList = "file_list";
const DisplayTypeFileTree = "file_tree";

// This buffer is applied to limit when a path is considered visible. If there are less than this many pixels
// of the file element visible on screen, then it is not be considered visible.
const VISIBILITY_BUFFER = 80;

// Minimum milliseconds to wait between calls to pollOnVisiblePaths
const ON_VISIBLE_DELAY = 200;

//Sidebar Settings
const isFilesOpen = "files";
const isSettingsOpen = "settings";
const isPackagesOpen = "packages";

class SinglePageContent extends React.PureComponent {
  render() {
    const { pathList, children, refForPath } = this.props;
    return (
      <React.Fragment>
        {pathList.map(path => {
          return (
            <div key={path} ref={refForPath(path)}>
              {children(path)}
            </div>
          );
        })}
      </React.Fragment>
    );
  }
}

class ContentGroupContainer extends React.PureComponent {
  state = {
    visiblePaths: null,
    sideBarSetting: isFilesOpen,
    activeHover: false
  };

  // Mapping of paths to refs to be used for scrolling to elements in OnePage display type
  pathToRef = {};

  scrollContainerRef = React.createRef();

  componentDidMount() {
    this.visibilityInterval = setInterval(
      this.checkVisiblePaths,
      ON_VISIBLE_DELAY
    );
  }

  componentWillUnmount() {
    clearInterval(this.visibilityInterval);
  }

  componentDidUpdate(prevProps) {
    const { selectedPath, displayType } = this.props;
    if (
      selectedPath &&
      prevProps.selectedPath !== selectedPath &&
      (displayType === DisplayTypeOnePage ||
        displayType === DisplayTypeOnePageTree)
    ) {
      const ref = this.pathToRef[selectedPath];
      if (ref) {
        this.scrollContainerRef.current.scrollTo({
          top: ref.current.offsetTop - this.scrollContainerRef.current.offsetTop
        });
      }
    }
  }

  selectIcon = icon => {
    this.setState({
      sideBarSetting: icon !== this.state.sideBarSetting ? icon : null
    });
  };

  refForPath = path => {
    if (this.pathToRef[path]) {
      return this.pathToRef[path];
    }
    const ref = React.createRef();
    this.pathToRef[path] = ref;
    return ref;
  };

  getVisiblePaths = () => {
    const { displayType, pathList, selectedPath } = this.props;
    if ([DisplayTypeFileList, DisplayTypeFileTree].includes(displayType)) {
      // If we aren't showing all files on the same page, then just return the selectedPath
      return [selectedPath];
    }
    const {
      bottom: scrollBottom,
      top: scrollTop
    } = this.scrollContainerRef.current.getBoundingClientRect();
    // TODO: when we add back the ability to "close" files in the UI, we should filter them here as well.
    return pathList.filter(path => {
      const ref = this.pathToRef[path];
      if (!ref || !ref.current) {
        return false;
      }
      const { top, bottom } = ref.current.getBoundingClientRect();
      // If the top of this element is at least VISIBILITY_BUFFER pixels visible inside its scroll container
      // or the bottom of the element is at least VISIBILITY_BUFFER pixels visible inside the scroll container
      // then we will consider it as visible.
      return (
        top + VISIBILITY_BUFFER < scrollBottom &&
        bottom - VISIBILITY_BUFFER > scrollTop
      );
    });
  };

  checkVisiblePaths = () => {
    const { pollOnVisiblePaths } = this.props;
    const visiblePaths = this.getVisiblePaths();

    if (!_.isEqual(this.state.visiblePaths, visiblePaths)) {
      this.setState({ visiblePaths });
    }

    if (pollOnVisiblePaths) {
      pollOnVisiblePaths(visiblePaths);
    }
  };

  renderFileList() {
    const { pathList, selectedPath, onSelectedPath } = this.props;
    return (
      <React.Fragment>
        {pathList.map(path => (
          <div
            className={`${styles.fileListPath} ${
              selectedPath === path ? styles.selectedPath : ""
            }`}
            key={path}
            onClick={() => onSelectedPath(path)}
          >
            {path}
          </div>
        ))}
      </React.Fragment>
    );
  }
  renderSelectedFileContent = () => {
    const { children, selectedPath } = this.props;
    return children(selectedPath);
  };
  handleFileCollapseClick = () => {
    if (this.state.sideBarSetting) {
      this.setState({ sideBarSetting: null, activeHover: false });
    } else {
      this.setState({ sideBarSetting: isFilesOpen });
    }
  };
  renderFileCollapseIcon = () => {
    const { sideBarSetting, activeHover } = this.state;
    const icon = sideBarSetting ? faChevronLeft : faChevronRight;
    return (
      <div
        className={`${styles.fileCollapseContainer} ${
          !activeHover ? styles.iconHidden : ""
        }`}
        onClick={this.handleFileCollapseClick}
        onMouseEnter={() => this.setState({ activeHover: true })}
        onMouseLeave={() => this.setState({ activeHover: false })}
      >
        <FontAwesomeIcon
          className={styles.fileCollapseIcon}
          icon={icon}
          size="1x"
        />
      </div>
    );
  };
  renderNavigationTitle = sideBarSetting => {
    switch (sideBarSetting) {
      case isSettingsOpen:
        return "Diff Settings";
      case isPackagesOpen:
        return "Package Management";
      default:
        return "Files";
    }
  };

  render() {
    const {
      children,
      displayType,
      header,
      pathList,
      dependencyPathList,
      selectedPath,
      onSelectedPath,
      onSelectedDependencyPath,
      renderDiffSettings
    } = this.props;
    const { sideBarSetting, visiblePaths } = this.state;
    return (
      <div className={styles.container}>
        <div
          className={styles.leftContainer}
          onMouseEnter={() => this.setState({ activeHover: true })}
          onMouseLeave={() => this.setState({ activeHover: false })}
        >
          <div className={styles.sideBar}>
            <FontAwesomeIcon
              icon={faCopy}
              size="2x"
              className={`${styles.icon} ${
                sideBarSetting === isFilesOpen ? styles.selectedIcon : ""
              }`}
              onClick={() => this.selectIcon(isFilesOpen)}
            />
            {dependencyPathList && dependencyPathList.length > 0 && (
              <FontAwesomeIcon
                icon={faBoxOpen}
                size="2x"
                className={`${styles.icon} ${
                  sideBarSetting === isPackagesOpen ? styles.selectedIcon : ""
                }`}
                onClick={() => this.selectIcon(isPackagesOpen)}
              />
            )}
            {!!renderDiffSettings && (
              <FontAwesomeIcon
                icon={faCog}
                size="2x"
                className={`${styles.icon} ${
                  sideBarSetting === isSettingsOpen ? styles.selectedIcon : ""
                }`}
                onClick={() => this.selectIcon(isSettingsOpen)}
              />
            )}
          </div>
          <div className={styles.openSidebarContainer}>
            {sideBarSetting && (
              <div className={styles.navigationTitle}>
                {this.renderNavigationTitle(sideBarSetting)}
              </div>
            )}
            {!!sideBarSetting && (
              <React.Fragment>
                <div className={styles.fileList}>
                  {sideBarSetting === isFilesOpen && (
                    <div className={styles.fileTree}>
                      {displayType === DisplayTypeFileTree ||
                      displayType === DisplayTypeOnePageTree ? (
                        <FileTree
                          visiblePaths={visiblePaths}
                          selectedPath={selectedPath}
                          pathList={pathList}
                          onSelectedPath={onSelectedPath}
                        />
                      ) : (
                        this.renderFileList()
                      )}
                    </div>
                  )}
                  {sideBarSetting === isPackagesOpen && !!dependencyPathList && (
                    <React.Fragment>
                      {
                        // FIXME: Implement the "One Page" and "File List" functions
                        //        for dependency files. We're just going to use
                        //        FileTree until the others are implemented if
                        //        they're implemented at all.
                        <FileTree
                          visiblePaths={visiblePaths}
                          selectedPath={selectedPath}
                          pathList={dependencyPathList}
                          onSelectedPath={onSelectedDependencyPath}
                        />
                      }
                    </React.Fragment>
                  )}
                  {sideBarSetting === isSettingsOpen &&
                    !!renderDiffSettings &&
                    renderDiffSettings()}
                </div>
              </React.Fragment>
            )}
            {this.renderFileCollapseIcon()}
          </div>
        </div>
        <div ref={this.scrollContainerRef} className={styles.innerContainer}>
          {header}
          {displayType === DisplayTypeOnePage ||
          displayType === DisplayTypeOnePageTree ? (
            <SinglePageContent
              pathList={pathList}
              children={children}
              refForPath={this.refForPath}
            />
          ) : (
            this.renderSelectedFileContent()
          )}
        </div>
      </div>
    );
  }
}

ContentGroupContainer.propTypes = {
  // type of content group to display. if none provided will use default/auto
  displayType: PropTypes.oneOf([
    DisplayTypeOnePage,
    DisplayTypeOnePageTree,
    DisplayTypeFileList,
    DisplayTypeFileTree
  ]),

  // Optional function to render the diff settings
  renderDiffSettings: PropTypes.func,

  // Optional header component
  header: PropTypes.node,

  // Called when a user selects a path from file list
  onSelectedPath: PropTypes.func.isRequired,

  // Called when a user selects a dependency path from file list
  onSelectedDependencyPath: PropTypes.func.isRequired,

  // Called both periodically and on scroll events. Called at most once per 200ms
  pollOnVisiblePaths: PropTypes.func,

  // list of file path strings
  pathList: PropTypes.arrayOf(PropTypes.string).isRequired,

  // list of path strings of dependency files
  dependencyPathList: PropTypes.arrayOf(PropTypes.string),

  // Controlled selection of path
  selectedPath: PropTypes.string
};

export default ContentGroupContainer;
