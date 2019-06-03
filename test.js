import React from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import PropTypes from "prop-types";
import styles from "./style.css";
import TextInput from "../TextInput";
import CommentThread from "../../containers/CommentThread";
import { theme, Banner, Flex, Body2 } from "common-react-ui";
import { faSearchengin } from "@fortawesome/free-brands-svg-icons";

function StartNewConversation({ onAddButtonClicked }) {
  return (
    <button
      className={styles.startNewConversationButton}
      onClick={onAddButtonClicked}
    >
      Start a new conversation
    </button>
  );
}

export function InlineCommentSection({
  pullRequestUUID,
  comments,
  pendingComments,
  staticResults,
  temporaryPendingComments,
  onAddButtonClicked,
  lineType,
  myUUID
}) {
  pendingComments = pendingComments
    ? pendingComments.filter(c => !c.in_reply_to_uuid)
    : [];

  const myPendingComments = pendingComments.filter(c => c.is_my_user);
  const otherPendingComments = pendingComments.filter(c => !c.is_my_user);

  // Temporary pending comments initialized by current reviewer
  const myTemporaryPendingComments = temporaryPendingComments
    ? temporaryPendingComments.filter(comment => comment.user_uuid === myUUID)
    : [];

  // Check for any inline pending comments initialized by current reviewer
  const myInlineComments = myPendingComments.length
    ? myPendingComments
    : myTemporaryPendingComments.length
    ? myTemporaryPendingComments
    : null;

  /** Shows StartNewConversation button if none of the inline pending comments
   *  were initialized by current reviewer */
  const showStartNewConversation =
    staticResults && !myInlineComments ? false : !myInlineComments;
  return (
    <div className={styles.container}>
      {comments &&
        comments.map((comment, i) => {
          return (
            <CommentThread
              key={i}
              lineType={lineType}
              pullRequestUUID={pullRequestUUID}
              comment={comment}
            />
          );
        })}
      {otherPendingComments.length > 0 &&
        otherPendingComments.map((comment, i) => {
          return (
            <CommentThread
              pending={true}
              lineType={lineType}
              key={i}
              pullRequestUUID={pullRequestUUID}
              comment={comment}
            />
          );
        })}

      {showStartNewConversation && (
        <StartNewConversation onAddButtonClicked={onAddButtonClicked} />
      )}

      {myInlineComments &&
        myInlineComments.map((comment, i) => {
          return (
            <div className={styles.textInputContainer} key={i}>
              <div className={styles.textInput}>
                <TextInput
                  lineType={lineType}
                  pullRequestUUID={pullRequestUUID}
                  comment={comment}
                  areComments={false}
                />
              </div>
            </div>
          );
        })}

      {staticResults &&
        staticResults.map((result, i) => {
          // there isn't a unique key per result currently so using index
          const resultName = JSON.stringify(result.name, null);
          const resultDescription = JSON.stringify(result.description, null);
          return (
            <Banner
              p="15px"
              m="10px"
              icon={faSearchengin}
              color={theme.colors.lightblue}
              key={i}
            >
              <Flex direction="column">
                <Body2 m="0 0 3px 15px">
                  <strong>Static Result:</strong>{" "}
                  {resultName.substring(1, resultName.length - 1)}
                </Body2>
                <Body2 ml="15px">
                  {resultDescription.substring(1, resultDescription.length - 1)}
                </Body2>
              </Flex>
            </Banner>
          );
        })}
    </div>
  );
}

function mapStateToProps(state) {
  const { entities } = state;
  const myUUID = entities.account.user.uuid;
  return {
    myUUID
  };
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators({}, dispatch);
}

InlineCommentSection.propTypes = {
  pullRequestUUID: PropTypes.string.isRequired,
  comments: PropTypes.array,
  pendingComments: PropTypes.array,
  staticResults: PropTypes.array,
  temporaryPendingComments: PropTypes.array,
  onAddButtonClicked: PropTypes.func
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(InlineCommentSection);
