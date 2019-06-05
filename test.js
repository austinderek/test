import * as Api from "../utils/Api";
import { addEntities } from "./entities";
import { addTemporaryEntities, deleteTemporaryEntities } from "./temporary";
import { fetchReviews } from "./review";
import { fetchStaticJobs } from "./staticJobs";
import { getOriginalShaPosition } from "../utils/blame";
import { normalizeArray } from "../utils/normalizationHelpers";
import { commentRepliesLookup } from "../utils/blame/index";

export const ADD_PULL_REQUEST = "ADD_PULL_REQUEST";

export function fetchCommentsForPullRequest(pullRequestUUID) {
  return dispatch => {
    Api.get(`review_api/pull_requests/${pullRequestUUID}/comments`).then(
      response => {
        if (response.success) {
          console.log("Got comments for pullRequest " + pullRequestUUID);
          const commentReplies = commentRepliesLookup(response.data);
          const commentsByUUID = response.data.reduce((acc, comment) => {
            acc[comment.uuid] = comment;
            return acc;
          }, {});

          dispatch(
            addEntities({
              commentReplies: {
                [pullRequestUUID]: commentReplies
              },
              comments: {
                [pullRequestUUID]: response.data
              },
              commentsByUUID
            })
          );
        } else {
          console.error(
            `Failed to fetch comments for pullRequest: ${pullRequestUUID}`
          );
        }
      }
    );
  };
}

export function fetchPendingComments(pullRequestUUID) {
  return dispatch => {
    Api.get(
      `review_api/pull_requests/${pullRequestUUID}/pending_comments`
    ).then(response => {
      if (response.success) {
        console.log("Got pending comments for uuid " + pullRequestUUID);
        const commentReplies = commentRepliesLookup(response.data);
        let summaryComment = response.data.filter(comment => comment.summary);
        summaryComment = summaryComment[0] ? summaryComment[0] : null;
        dispatch(
          addEntities({
            pendingComments: {
              [pullRequestUUID]: response.data
            },
            pendingCommentReplies: {
              [pullRequestUUID]: commentReplies
            },
            pendingSummaries: {
              [pullRequestUUID]: summaryComment
            }
          })
        );
      } else {
        console.error(
          `Failed to fetch pendingComments for uuid: ${pullRequestUUID}`
        );
      }
    });
  };
}

export const fetchPullRequest = pullRequestUUID => {
  return (dispatch, getState) => {
    // go ahead and fire off fetching static jobs at same time as the pull request uuid since we
    // block loading everything else on these.
    // TODO: look into firing off requests for everything we need at the same time just to avoid the extra RTT
    const flags = getState().entities.account.user.feature_flags;
    if (flags && flags.REVIEWER_CLIENT_SHOW_STATIC_RESULTS) {
      dispatch(fetchStaticJobs(pullRequestUUID));
    }

    return Api.get(`review_api/pull_requests/${pullRequestUUID}`).then(
      response => {
        if (response.success) {
          console.log("Got pull request for uuid " + pullRequestUUID);
          const pullRequestCommits =
            (response.data && response.data.commits) || [];
          const {
            entities: { commits }
          } = normalizeArray(pullRequestCommits, "commits");

          const prevPullRequest = getState().entities.pullRequests[
            pullRequestUUID
          ];

          if (!prevPullRequest) {
            // If this is the first time we are fetching this pull request then seed the review_status
            // so that all subsequent pings will be relative to this initial fetch.
            dispatch(
              addTemporaryEntities({
                reviewStatus: {
                  [pullRequestUUID]: response.data.review_status
                }
              })
            );
          }

          dispatch(
            addEntities({
              pullRequests: {
                [pullRequestUUID]: response.data
              },
              commits: {
                [pullRequestUUID]: commits
              }
            })
          );
          dispatch(fetchCommentsForPullRequest(pullRequestUUID));
          dispatch(fetchPendingComments(pullRequestUUID));
          dispatch(fetchReviews(pullRequestUUID));
        } else {
          console.error(
            `Failed to fetch pullRequest for uuid: ${pullRequestUUID}`
          );
        }
        return response;
      }
    );
  };
};

function pendingCommentLocation(
  diffs,
  pullRequestUUID,
  originalSha,
  filePath,
  originalLineNumber
) {
  const { sha, lineNumber } = getOriginalShaPosition(
    diffs,
    originalSha,
    filePath,
    originalLineNumber
  );
  if (!sha || !lineNumber) {
    console.error(
      "Unable to get root sha position for pending comment: " + pullRequestUUID
    );
    return null;
  }
  const key = `${pullRequestUUID}:${sha}:${filePath}:${lineNumber}`;
  return {
    pullRequestUUID,
    sha,
    filePath,
    lineNumber,
    key,
    originalSha,
    originalLineNumber
  };
}

function postPendingComment(location, userUUID, lineType) {
  return (dispatch, getState) => {
    const {
      pullRequestUUID,
      sha,
      filePath,
      lineNumber,
      key,
      originalSha,
      originalLineNumber
    } = location;
    // Grab the latest message for this comment
    const { temporary } = getState();

    // An empty string is sent to effectively delete the pending message
    const message = temporary.textInputMessages[key] || "";
    const category = temporary.commentCategories[key] || null;

    Api.post(`review_api/pull_requests/${pullRequestUUID}/pending_comments`, {
      message: message,
      sha: sha,
      path: filePath,
      line_number: lineNumber,
      line_type: lineType,
      original_sha: originalSha,
      original_line_number: originalLineNumber,
      user_uuid: userUUID,
      category
    }).then(response => {
      if (!response.success) {
        console.error("Failed to post pending comment");
      }
      // Update the pending comments
      dispatch(fetchPendingComments(pullRequestUUID));
      dispatch(
        addTemporaryEntities({
          active: {
            lastSavedAt: Date.now()
          }
        })
      );
    });
  };
}

function postPendingCommentReply(pullRequestUUID, inReplyTo, userUUID) {
  return (dispatch, getState) => {
    // Grab the latest message for this comment
    const { temporary } = getState();
    // An empty string is sent to effectively delete the pending message
    const message =
      temporary.textInputMessages[`${userUUID}:${inReplyTo}`] || "";

    Api.post(`review_api/pull_requests/${pullRequestUUID}/pending_comments`, {
      message: message,
      in_reply_to_uuid: inReplyTo,
      user_uuid: userUUID
    }).then(response => {
      if (!response.success) {
        console.error("Failed to post pending comment reply");
      }
      // Update the pending comments
      dispatch(fetchPendingComments(pullRequestUUID));
      dispatch(
        addTemporaryEntities({
          active: {
            lastSavedAt: Date.now()
          }
        })
      );
    });
  };
}

function postPendingSummaryComment(pullRequestUUID, userUUID) {
  return (dispatch, getState) => {
    // Grab the latest message for this comment
    const { temporary } = getState();
    // An empty string is sent to effectively delete the pending message
    const message =
      temporary.textInputMessages[`${pullRequestUUID}:summary`] || "";

    Api.post(`review_api/pull_requests/${pullRequestUUID}/pending_comments`, {
      message: message,
      summary: true,
      user_uuid: userUUID
    }).then(response => {
      if (!response.success) {
        console.error("Failed to post pending comment reply");
      }
      // Update the pending comments
      dispatch(fetchPendingComments(pullRequestUUID));
      dispatch(
        addTemporaryEntities({
          active: {
            lastSavedAt: Date.now()
          }
        })
      );
    });
  };
}

const waitingToPostMap = {};

const COMMENT_POST_DELAY = 500; // 0.5 seconds after last character typed before we update the server

export function createPendingComment(comment) {
  return (dispatch, getState) => {
    const { entities, temporary } = getState();
    if (!comment.userUUID) {
      comment.userUUID = entities.account.user.uuid;
    }
    const {
      pullRequestUUID,
      sha,
      filePath,
      lineNumber,
      lineType,
      inReplyTo,
      userUUID
    } = comment;
    let key = null;
    let location = null;
    if (inReplyTo) {
      key = `${userUUID}:${inReplyTo}`;
    } else {
      location = pendingCommentLocation(
        entities.diffs,
        pullRequestUUID,
        sha,
        filePath,
        lineNumber
      );
      if (!location) {
        console.error(
          `Unable to calculate root position for pending comment (${pullRequestUUID}, ${sha}, ${filePath}, ${lineNumber})`
        );
        return;
      }
      key = `${userUUID}:${location.key}`;
    }
    if (temporary.textInputMessages[key] === undefined) {
      const pendingComment = inReplyTo
        ? {
            in_reply_to_uuid: inReplyTo,
            user_uuid: userUUID
          }
        : {
            sha: location.sha,
            path: filePath,
            line_number: location.lineNumber,
            line_type: lineType,
            original_sha: sha,
            original_line_number: lineNumber,
            user_uuid: userUUID
          };
      dispatch(
        addTemporaryEntities({
          pendingComments: {
            [key]: pendingComment
          }
        })
      );
    }
  };
}

export function updatePendingComment(comment) {
  return (dispatch, getState) => {
    const { entities, temporary } = getState();
    if (!comment.userUUID) {
      comment.userUUID = entities.account.user.uuid;
    }
    const {
      pullRequestUUID,
      category,
      sha,
      filePath,
      lineNumber,
      lineType,
      inReplyTo,
      message,
      userUUID,
      originalSha,
      originalLineNumber
    } = comment;
    let key = null;
    if (inReplyTo) {
      key = `${userUUID}:${inReplyTo}`;
    } else {
      key = `${userUUID}:${pullRequestUUID}:${sha}:${filePath}:${lineNumber}`;
    }
    if (!temporary.textInputMessages[key]) {
      const pendingComment = inReplyTo
        ? {
            in_reply_to_uuid: inReplyTo,
            user_uuid: userUUID
          }
        : {
            sha: sha,
            path: filePath,
            line_number: lineNumber,
            line_type: lineType,
            original_sha: originalSha,
            original_line_number: originalLineNumber,
            user_uuid: userUUID
          };
      dispatch(
        addTemporaryEntities({
          pendingComments: {
            [key]: pendingComment
          }
        })
      );
    }

    dispatch(
      addTemporaryEntities({
        textInputMessages: {
          [key]: message
        },
        commentCategories: {
          [key]: category
        },
        active: {
          updatingCommentAt: Date.now()
        }
      })
    );
    const currentTask = waitingToPostMap[key];
    if (currentTask !== undefined) {
      // Already waiting to post for this comment, lets delay the timer again
      clearInterval(currentTask);
    }
    // post the latest message for this key in COMMENT_POST_DELAY seconds
    waitingToPostMap[key] = setTimeout(() => {
      if (inReplyTo) {
        dispatch(postPendingCommentReply(pullRequestUUID, inReplyTo, userUUID));
      } else {
        const location = {
          pullRequestUUID,
          sha,
          filePath,
          lineNumber,
          key,
          originalSha,
          originalLineNumber
        };
        dispatch(postPendingComment(location, userUUID, lineType));
      }
      delete waitingToPostMap[key];
    }, COMMENT_POST_DELAY);
  };
}

export function updatePendingSummaryComment(
  comment,
  pullRequestUUID,
  userUUID
) {
  return (dispatch, getState) => {
    const { temporary, entities } = getState();
    if (!userUUID) {
      userUUID = entities.account.user.uuid;
    }
    const key = `${pullRequestUUID}:summary`;
    const isFirstEmptyMessage = !temporary.textInputMessages[key];
    if (isFirstEmptyMessage) {
      const pendingSummaryComment = {
        message: "",
        summary: true
      };
      dispatch(
        addTemporaryEntities({
          pendingSummaries: {
            [pullRequestUUID]: pendingSummaryComment
          }
        })
      );
    }
    dispatch(
      addTemporaryEntities({
        textInputMessages: {
          [key]: comment
        },
        active: {
          updatingCommentAt: Date.now()
        }
      })
    );
    if (isFirstEmptyMessage) {
      //   If this is the first empty message for this key, then don't send it to the server since the user has only opened
      //   the review summary text area at this point.
      return;
    }
    const currentTask = waitingToPostMap[key];
    if (currentTask !== undefined) {
      // Already waiting to post for this comment, lets delay the timer again
      clearInterval(currentTask);
    }
    // post the latest message for this key in COMMENT_POST_DELAY seconds
    waitingToPostMap[key] = setTimeout(() => {
      dispatch(postPendingSummaryComment(pullRequestUUID, userUUID));
      delete waitingToPostMap[key];
    }, COMMENT_POST_DELAY);
  };
}

export function deletePendingComment(comment) {
  return (dispatch, getState) => {
    const { entities } = getState();
    if (!comment.userUUID) {
      comment.userUUID = entities.account.user.uuid;
    }
    const {
      sha,
      filePath,
      lineNumber,
      pullRequestUUID,
      inReplyTo,
      userUUID,
      lineType
    } = comment;
    let key = null;
    if (inReplyTo) {
      key = `${userUUID}:${inReplyTo}`;
    } else {
      key = `${userUUID}:${pullRequestUUID}:${sha}:${filePath}:${lineNumber}`;
    }

    // Delete the local copy of pending comment from server since those would show up after it is deleted from temporary
    if (inReplyTo) {
      const pendingReplies =
        entities.pendingCommentReplies[pullRequestUUID][inReplyTo];
      if (pendingReplies && pendingReplies.length > 0) {
        // If exists, so delete it from a copy and set it back
        const newPendingReplies = {
          ...entities.pendingCommentReplies[pullRequestUUID]
        };
        delete newPendingReplies[inReplyTo];
        dispatch(
          addEntities({
            pendingCommentReplies: {
              [pullRequestUUID]: newPendingReplies
            }
          })
        );
      }
    }

    // Then delete from the temporary store
    dispatch(
      deleteTemporaryEntities({
        pendingComments: { key },
        textInputMessages: { key }
      })
    );
    // Posting the comment after it has been deleted from our state will delete it from the server
    if (inReplyTo) {
      dispatch(postPendingCommentReply(pullRequestUUID, inReplyTo, userUUID));
    } else {
      const location = {
        pullRequestUUID,
        sha,
        filePath,
        lineNumber,
        key
      };
      dispatch(postPendingComment(location, userUUID, lineType));
    }
  };
}
