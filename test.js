import React, { useState } from "react";

export default function MyComponent() {
  const { missingPropType } = this.props;
  const [text, setText] = useState("MyComponent");

  console.log("This should show a static result in the client.");

  return <div>{text}</div>;
}
