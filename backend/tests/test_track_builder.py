from app.services.track_builder import TrackBuilder


def test_gaps_and_recovery():
    b = TrackBuilder()
    box = (0, 0, 10, 10)
    for f in (0, 1, 2, 6, 7):          # vessel lost for frames 3-5, then recovered
        b.add(f, 7, box, 0.8)
    b.add(4, 9, box, 0.5)              # a second, single-frame track

    t7, t9 = b.build("job", fps=25)
    assert t7["track_id"] == 7
    assert t7["n_detections"] == 5
    assert t7["span_frames"] == 8
    assert t7["n_gaps"] == 1 and t7["longest_gap"] == 3
    assert t7["recovery_events"] == [{"lost_after": 2, "recovered_at": 6, "gap": 3}]
    assert t9["n_gaps"] == 0 and t9["n_detections"] == 1
