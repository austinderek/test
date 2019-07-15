import React, { PureComponent } from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import {
  FeedbackSelect,
  theme,
  Flex,
  Tooltip,
  Link,
  ActionMenu,
  Div
} from "common-react-ui";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInfoCircle } from "@fortawesome/fontawesome-pro-regular";
import { faMarkdown } from "@fortawesome/free-brands-svg-icons";
import styles from "./style.css";
import EmojiTextArea from "../../components/EmojiTextArea";
import * as PullRequestActions from "../../actions/pullRequest";
import UserAvatar from "../../components/UserAvatar";
import FormattedComment from "../../components/FormattedComment";

const colorForGroup = {
  comment: theme.colors.green,
  suggestion: theme.colors.lightblue,
  issue: theme.colors.orange
};

const categoryOptionsFromGroups = categoryGroups => {
  const options = {};
  const groups = Object.keys(categoryGroups).map(group => {
    const categories = categoryGroups[group];
    return {
      label: group,
      options: Object.keys(categories).map(category => {
        const result = {
          value: `${group}:${category}`,
          label: categories[category].name,
          color: colorForGroup[group] || theme.colors.darkgrey
        };
        options[result.value] = result;
        return result;
      })
    };
  });
  const otherOption = {
    value: "other",
    label: "Other",
    color: theme.colors.darkgrey
  };
  groups.push({
    label: "uncategorized",
    options: [otherOption]
  });
  options["other"] = otherOption;
  return { options, groups };
};
//Comment
export class TextInput extends PureComponent {
  state = {
    inputMode: "write"
  };

  constructor(props) {
    super(props);

    const { categoryGroups, featureFlags } = props;

    this.enableCategories = !!featureFlags[
      "REVIEWER_CLIENT_COMMENT_CATEGORIES"
    ];

    if (this.enableCategories) {
      const { options, groups } = categoryOptionsFromGroups(categoryGroups);
      this.categoryOptions = options;
      this.categoryGroups = groups;
    }
  }

  categoryStringToOption = categoryString => {
    return this.categoryOptions[categoryString] || null;
  };

  onChangeCategory = option => {
    this.updateComment({ category: option.value });
  };

  updateComment = commentData => {
    const {
      category,
      comment,
      message,
      updatePendingComment,
      lineType,
      pullRequestUUID
    } = this.props;
    commentData = {
      pullRequestUUID,
      category,
      message,
      ...commentData
    };
    if (comment && !comment.is_my_user) {
      commentData.userUUID = comment.user_uuid;
    }
    const inReplyTo = comment ? comment.in_reply_to_uuid : null;
    if (inReplyTo) {
      commentData = { ...commentData, inReplyTo };
    } else {
      commentData = {
        ...commentData,
        lineType,
        sha: comment.sha,
        originalSha: comment.original_sha,
        filePath: comment.path,
        lineNumber: comment.line_number,
        originalLineNumber: comment.original_line_number
      };
    }
    updatePendingComment(commentData);
  };

  onTextUpdate = message => {
    this.updateComment({ message });
  };

  onDelete = () => {
    const {
      pullRequestUUID,
      comment,
      deletePendingComment,
      lineType
    } = this.props;
    let commentData = { pullRequestUUID };
    if (comment && !comment.is_my_user) {
      commentData.userUUID = comment.user_uuid;
    }
    const inReplyTo = comment ? comment.in_reply_to_uuid : null;
    if (inReplyTo) {
      commentData = { ...commentData, inReplyTo };
    } else {
      commentData = {
        ...commentData,
        lineType,
        sha: comment.sha,
        filePath: comment.path,
        lineNumber: comment.line_number
      };
    }
    deletePendingComment(commentData);
  };

  toggleInputMode = inputMode => {
    this.setState({ inputMode });
  };

  render() {
    const { areComments, comment, category } = this.props;
    const message = this.props.message || "";

    let containerStyle = `${styles.container} ${
      areComments ? styles.topBorder : ""
    }`;

    if (comment && comment.in_reply_to_uuid && comment.is_my_user === false) {
      containerStyle = ` ${styles.pendingReply}`;
    }

    if (message && message !== "") {
      containerStyle += ` ${styles.pendingState}`;
    }

    const placeholderText = areComments
      ? "Type a reply..."
      : "Leave a comment...";

    const menuOptions = [
      {
        label: "Delete Comment",
        color: theme.colors.red,
        action: this.onDelete
      }
    ];
    return (
      <div className={containerStyle}>
        {(message || !areComments) && (
          <Flex
            justifyContent="space-between"
            alignItems="center"
            width="100%"
            m="4px 0"
          >
            <Flex ml="40px">
              <Link
                onClick={() => this.toggleInputMode("write")}
                mr="15px"
                pb="3px"
                color={theme.colors.darkblue}
                className={`${styles.inputModeTab} ${
                  this.state.inputMode === "write" ? styles.activeInputMode : ""
                }`}
              >
                Write
              </Link>
              <Link
                pb="3px"
                onClick={() => this.toggleInputMode("preview")}
                color={theme.colors.darkblue}
                className={`${styles.inputModeTab} ${
                  this.state.inputMode === "preview"
                    ? styles.activeInputMode
                    : ""
                }`}
              >
                Preview
              </Link>
            </Flex>
            <Flex>
              <Link
                href="https://docs.pullrequest.com/the-pullrequest-reviewer-platform/markdown-syntax-guide"
                target="_blank"
                rel="noopener noreferrer"
                mr="15px"
              >
                <FontAwesomeIcon
                  data-tip="Styling with markdown is supported. Click to read our syntax guide."
                  data-for="markdown"
                  data-place="left"
                  data-effect="solid"
                  icon={faMarkdown}
                  className={styles.markdownIcon}
                />
              </Link>
              <FontAwesomeIcon
                icon={faInfoCircle}
                color="#555"
                style={{ display: message ? "initial" : "none" }}
                data-tip="This comment will be posted when you submit the review."
                data-for="pendingComment"
                data-place="left"
                data-effect="solid"
                className={styles.infoIcon}
              />
              <ActionMenu width="150px" options={menuOptions} />
            </Flex>
          </Flex>
        )}
        <Flex
          width="100%"
          alignItems="flex-start"
          mt="10px"
          style={{ flexWrap: "nowrap" }}
        >
          <UserAvatar
            isPullRequestUser={true}
            style={{ alignSelf: "flex-start" }}
          />
          <div className={styles.innerContainer}>
            <div className={styles.textArea}>
              {this.state.inputMode === "write" && (
                <EmojiTextArea
                  onTextUpdate={this.onTextUpdate}
                  message={message}
                  minRows={4}
                  placeholder={placeholderText}
                />
              )}
              {this.state.inputMode === "preview" && (
                <Div
                  background="white"
                  m="0 0 10px 10px"
                  p="10px"
                  border={`1px solid ${theme.colors.darkblue}`}
                  borderRadius="4px"
                  style={{ minHeight: "60px" }}
                >
                  <FormattedComment message={message || "Nothing to preview"} />
                </Div>
              )}
            </div>
            <Tooltip id="pendingComment" />
            <Tooltip id="markdown" textAlign="center" />
          </div>
        </Flex>
        <div className={styles.bottomRow}>
          {this.enableCategories && message && !areComments && (
            <div className={styles.categoryContainer}>
              {category
                ? "Feedback category"
                : "Please select a category for this comment"}
              <FeedbackSelect
                m="6px 0"
                value={this.categoryStringToOption(category)}
                onChange={this.onChangeCategory}
                options={this.categoryGroups}
              />
            </div>
          )}
          <div className={styles.spacer} />
          <div className={styles.instructionText}>
            {message && comment.is_my_user === false && (
              <span>
                By <strong>{comment.user_name}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state, ownProps) {
  const { comment, pullRequestUUID } = ownProps;
  let category = null;
  let message = null;
  if (comment) {
    const inReplyTo = comment.in_reply_to_uuid;
    const key = inReplyTo
      ? `${comment.user_uuid}:${inReplyTo}`
      : `${comment.user_uuid}:${pullRequestUUID}:${comment.sha}:${
          comment.path
        }:${comment.line_number}`;
    const tempMessage = state.temporary.textInputMessages[key];
    if (tempMessage !== undefined) {
      message = tempMessage;
    } else {
      message = comment.message || null;
    }
    category =
      state.temporary.commentCategories[key] || comment.category || null;
  }
  const featureFlags = state.entities.account.user.feature_flags;
  return {
    message,
    category,
    categoryGroups: state.entities.account.user.comment_categories,
    featureFlags
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(PullRequestActions, dispatch);
}

TextInput.propTypes = {
  message: PropTypes.string,
  featureFlags: PropTypes.object.isRequired,
  updatePendingComment: PropTypes.func.isRequired,
  deletePendingComment: PropTypes.func.isRequired,
  areComments: PropTypes.bool,
  // These props will not always exist unless comment is missing
  sha: PropTypes.string,
  path: PropTypes.string,
  lineNumber: PropTypes.number,
  lineType: PropTypes.string
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TextInput);
