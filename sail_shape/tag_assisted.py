import math

import cv2
import numpy as np


def detect_tags(image):
    aruco_dict = cv2.aruco.Dictionary_get(cv2.aruco.DICT_4X4_50)
    aruco_params = cv2.aruco.DetectorParameters_create()
    (corners, ids, rejected) = cv2.aruco.detectMarkers(image, aruco_dict,
                                                       parameters=aruco_params)
    # Build the stripe bounding boxes
    start_rects = []
    end_rects = []
    # Each stripe marked by two subsequent tags
    for tag_id in range(1, 7, 2):
        s = np.where(ids == tag_id)[0]
        e = np.where(ids == tag_id + 1)[0]
        if len(s) > 0 and len(e) > 0:  # Stripe is detected
            # Determine stripe boundaries
            start_rects.append(corners[s[0]][0])
            end_rects.append(corners[e[0]][0])
    return end_rects, start_rects


def fit_stripe(pts, stds):
    x = pts[:, 0]
    y = pts[:, 1]
    w = 1. / stds
    z = np.polyfit(x, y, 5, w=w)
    p = np.poly1d(z)
    fit_pts = np.zeros_like(pts)
    for i in range(len(x)):
        fit_pts[i, 0] = x[i]
        fit_pts[i, 1] = p(x[i])
    return fit_pts


def trace_draft_stripe(cropped_image, tag_id):
    min_threshold = 127
    max_threshold = 255
    th, binary_img = cv2.threshold(cropped_image, min_threshold, max_threshold, cv2.THRESH_BINARY_INV)
    cv2.imshow("Binary {}".format(tag_id), binary_img)
    wind_w = 10
    wind_h = binary_img.shape[0]
    pts = []
    stds = []
    for x in range(0, binary_img.shape[1]):
        wind = binary_img[0:wind_h, x: x + wind_w]
        hist = wind.sum(axis=1)
        y = np.argmax(hist)
        stds.append(np.std(hist))
        pts.append([x, y])
    pts = np.array(pts, np.int32)
    stds = np.array(stds)
    return pts, stds


def get_stripe_params(pts):
    y = pts[:, 1]
    draft_x = np.argmax(y)
    camber_y = y[draft_x]
    min_y = np.min(y)
    draft_perc = float(draft_x) / len(y) * 100
    camber_perc = float(camber_y - min_y) / len(y) * 100
    return draft_perc, camber_perc


STRIPE_NAMES = [
   'Bottom',
   'Middle',
   'Top',
]


def measure_sail_shape(input_name):
    print("[INFO] loading image...")
    image = cv2.imread(input_name)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # cv2.imshow("Sail shape", image)

    # Detect the markers
    end_rects, start_rects = detect_tags(image)

    for stripe_idx in range(len(start_rects)):
        start_rect = start_rects[stripe_idx]
        end_rect = end_rects[stripe_idx]

        # Determine stripe boundaries
        start_x = np.int(np.mean(start_rect[:, 0]))
        start_y = np.int(np.mean(start_rect[:, 1]))
        end_x = np.int(np.mean(end_rect[:, 0]))
        end_y = np.int(np.mean(end_rect[:, 1]))

        # Chord line
        angle = math.degrees(math.atan2(end_y - start_y, end_x - start_x))
        rot_mat = cv2.getRotationMatrix2D((start_x, start_y), angle, 1.0)

        # Mask the tags rectangles
        mask_rect = np.zeros_like(image)
        rect = np.array(start_rect, np.int32)
        rect = rect.reshape((-1, 1, 2))
        cv2.fillPoly(mask_rect, [rect], (255, 255, 255))
        rect = np.array(end_rect, np.int32)
        rect = rect.reshape((-1, 1, 2))
        cv2.fillPoly(mask_rect, [rect], (255, 255, 255))
        masked_image = cv2.bitwise_or(image, mask_rect)

        # Rotate image
        rotated = cv2.warpAffine(masked_image, rot_mat, image.shape[1::-1], flags=cv2.INTER_LINEAR)

        # Find corners coordinates in rotated image
        rot_end_rect = cv2.transform(np.array([end_rect]), rot_mat)

        rot_end_x = np.int(np.mean(rot_end_rect[0][:, 0]))
        rot_end_y = np.int(np.mean(rot_end_rect[0][:, 1]))

        chord_length = math.sqrt((start_x - rot_end_x) ** 2 + (start_y - rot_end_y) ** 2)
        max_depth = int(chord_length * 0.2)

        # Cropping an image
        cropped_image = rotated[start_y:start_y + max_depth, start_x:rot_end_x]

        # Trace the stripe
        pts, stds = trace_draft_stripe(cropped_image, stripe_idx)

        # Fit polynomial to the detected stripe points
        fit_pts = fit_stripe(pts, stds)

        # Get stripe shape parameters
        draft, camber = get_stripe_params(fit_pts)
        print(f' {STRIPE_NAMES[stripe_idx]} draft {draft:.1f} camber {camber:.1f} twist {angle:.1f}')

        cv2.polylines(cropped_image, [fit_pts.reshape((-1, 1, 2))], False, (255, 255, 255), thickness=4)

        cv2.imshow("Cropped {}".format(stripe_idx), cropped_image)

    cv2.waitKey(0)
