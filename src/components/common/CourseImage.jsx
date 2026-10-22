import React from "react";

const FALLBACK = "/course-placeholder.svg";

export function CourseImage({ src, alt = "", onError, ...props }) {
  return <img {...props} src={src || FALLBACK} alt={alt} onError={event => {
    if (event.currentTarget.getAttribute("src") !== FALLBACK) event.currentTarget.src = FALLBACK;
    onError?.(event);
  }} />;
}
